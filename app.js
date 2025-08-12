// --- INIT FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyA2mxa0BR-V7FtqCFxkXtSoOTGUFXbI4M4",
  authDomain: "gammaton-fdbfd.firebaseapp.com",
  databaseURL: "https://gammaton-fdbfd-default-rtdb.firebaseio.com",
  projectId: "gammaton-fdbfd",
  storageBucket: "gammaton-fdbfd.appspot.com",
  messagingSenderId: "118045498245",
  appId: "1:118045498245:web:f09ac245c00b2040c1c2ec"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
let user = null;
let userRef = null;
let uid = null;

// --- TON Connect UI ---
let tonConnectUI = null;
let tonWallet = null;
const TON_RECEIVER = "UQAmTM_EE8D6seecLKf-h8aXVQasliniDDQ52EvBj7PqExNr";

// --- USER AUTH ---
firebase.auth().onAuthStateChanged(async function(currentUser) {
  if (currentUser) {
    user = currentUser;
    uid = user.uid;
    userRef = db.ref('users/' + uid);
    await loadUser();
  } else {
    firebase.auth().signInAnonymously();
  }
});

// --- LOAD USER ---
async function loadUser() {
  userRef.once('value', snapshot => {
    if (!snapshot.exists()) {
      userRef.set({
        energy: 0,
        gamma: 0,
        ton: 0,
        premium: false,
        premiumForever: false,
        premiumUntil: null,
        buildings: { solar: 0, wind: 0, water: 0, premium: 0 },
        levels: { solar: 1, wind: 1, water: 1, premium: 1 },
        lastEnergyRoulette: 0,
        lastLuckRoulette: 0,
        joined: Date.now(),
        tonWallet: tonWallet || null
      });
    }
    renderBalances();
    renderSection('city');
  });
}

function saveTonWalletToProfile(address) {
  if (uid) {
    db.ref('users/' + uid + '/tonWallet').set(address);
  }
}

// --- TON CONNECT ---
window.onload = async () => {
  tonConnectUI = new window.TonConnectUI({
    manifestUrl: "ton-manifest.json",
    buttonRootId: "ton-connect-btn"
  });

  tonConnectUI.onStatusChange(wallet => {
    if (wallet && wallet.account) {
      tonWallet = wallet.account.address;
      document.getElementById('ton-wallet-address').textContent = 'Ваш TON адрес: ' + tonWallet;
      saveTonWalletToProfile(tonWallet);
    } else {
      tonWallet = null;
      document.getElementById('ton-wallet-address').textContent = '';
    }
  });

  renderBalances();
  renderSection('city');
};

// --- BALANCES ---
function renderBalances() {
  userRef.once('value', snap => {
    const d = snap.val() || {};
    document.getElementById('energy-balance').textContent = `Энергия: ${d.energy || 0}`;
    document.getElementById('gamma-balance').textContent = `Gamma Coin: ${d.gamma || 0}`;
    document.getElementById('ton-balance').textContent = `Ton: ${d.ton || 0}`;
    let premTxt = '';
    if (d.premiumForever) premTxt = 'Премиум ∞';
    else if (d.premium && d.premiumUntil) premTxt = 'Премиум до ' + new Date(d.premiumUntil).toLocaleDateString();
    document.getElementById('premium-status').textContent = premTxt;
  });
}

// --- UI NAVIGATION ---
document.getElementById('shop-btn').onclick = () => renderSection('shop');
document.getElementById('city-btn').onclick = () => renderSection('city');
document.getElementById('exchange-btn').onclick = () => renderSection('exchange');
document.getElementById('leaderboard-btn').onclick = () => renderSection('leaderboard');
document.getElementById('events-btn').onclick = () => renderSection('events');

// --- MODAL ---
function showModal(html) {
  const modal = document.getElementById('modal');
  const cont = document.getElementById('modal-content');
  cont.innerHTML = html;
  modal.classList.remove('hidden');
}
function closeModal() {
  document.getElementById('modal').classList.add('hidden');
}

// --- SHOP DATA ---
const buildingsData = [
  { key: 'solar', name: 'Солнечная батарея', img: 'solar.png', price: 7, prod: [700,1000,2100,4400,5700], lvlPrice:[7,10,37,54,107] },
  { key: 'wind', name: 'Воздушная батарея', img: 'wind.png', price: 21, prod: [2100,4400,5700,9600,17300], lvlPrice:[21,58,127,256,448] },
  { key: 'water', name: 'Водная батарея', img: 'water.png', price: 76, prod: [5700,9600,17300,26700,48400], lvlPrice:[76,148,272,437,821] },
  { key: 'premium', name: 'Премиум батарея', img: 'premium.png', price: 500, prod: [20000,35000,50000,80000,120000], lvlPrice:[500,1000,2000,4000,8000], premium:true }
];

// --- SHOP SECTION ---
function renderShop(area) {
  userRef.once('value', snap => {
    const d = snap.val();
    area.innerHTML = '<h2>Магазин зданий</h2>';
    buildingsData.forEach(bld => {
      let owned = d.buildings[bld.key] || 0;
      let lvl = d.levels[bld.key] || 1;
      let canBuy = d.gamma >= bld.price && (!bld.premium || d.premium || d.premiumForever);
      area.innerHTML += `
      <div class="shop-building">
        <img src="${bld.img}" alt="${bld.name}">
        <div class="info">
          <div><b>${bld.name}</b></div>
          <div>Уровень: ${lvl} <button class="level-up-btn" ${d.gamma < bld.lvlPrice[lvl] || lvl>=5 ? 'disabled':''} data-key="${bld.key}">⬆️ Апгрейд (${bld.lvlPrice[lvl]||'-'} GC)</button></div>
          <div>Владеет: ${owned}</div>
          <div>Добыча: ${bld.prod[lvl-1]} э/ч</div>
        </div>
        <button class="buy-btn" ${canBuy?'':'disabled'} data-key="${bld.key}">Купить (${bld.price} GC)</button>
      </div>`;
    });
    setTimeout(() => {
      Array.from(document.getElementsByClassName('buy-btn')).forEach(btn => {
        btn.onclick = () => buyBuilding(btn.dataset.key);
      });
      Array.from(document.getElementsByClassName('level-up-btn')).forEach(btn => {
        btn.onclick = () => levelUpBuilding(btn.dataset.key);
      });
    }, 100);
  });
}

function buyBuilding(key) {
  userRef.transaction(d => {
    if (!d) return d;
    let b = buildingsData.find(b=>b.key===key);
    if (!b) return d;
    if (d.gamma>=b.price && (!b.premium||d.premium||d.premiumForever)) {
      d.gamma -= b.price;
      d.buildings[key] = (d.buildings[key]||0)+1;
    }
    return d;
  }, () => { renderBalances(); renderSection('shop'); });
}

function levelUpBuilding(key) {
  userRef.transaction(d => {
    if (!d) return d;
    let b = buildingsData.find(b=>b.key===key);
    let lvl = d.levels[key]||1;
    if (lvl<5 && d.gamma>=b.lvlPrice[lvl]) {
      d.gamma -= b.lvlPrice[lvl];
      d.levels[key] = lvl+1;
    }
    return d;
  }, () => { renderBalances(); renderSection('shop'); });
}

// --- CITY SECTION ---
function renderCity(area) {
  userRef.once('value', snap => {
    const d = snap.val();
    area.innerHTML = '<h2>Город</h2>';
    buildingsData.forEach(bld => {
      let owned = d.buildings[bld.key]||0;
      let lvl = d.levels[bld.key]||1;
      if (owned>0) {
        area.innerHTML += `<div class="shop-building">
          <img src="${bld.img}" alt="${bld.name}">
          <div class="info">
            <div><b>${bld.name}</b> x${owned}</div>
            <div>Уровень: ${lvl}</div>
            <div>Добыча: ${bld.prod[lvl-1]} э/ч</div>
          </div>
        </div>`;
      }
    });
    area.innerHTML += `<div style="margin-top:18px;">
      <button onclick="collectEnergy()" class="buy-btn">Собрать доход</button>
      <div id="collect-msg"></div>
    </div>`;
  });
}
function collectEnergy() {
  userRef.transaction(d => {
    if (!d) return d;
    let total = 0;
    buildingsData.forEach(bld => {
      let owned = d.buildings[bld.key]||0;
      let lvl = d.levels[bld.key]||1;
      total += owned*bld.prod[lvl-1];
    });
    d.energy = (d.energy||0) + total;
    return d;
  }, () => {
    renderBalances();
    document.getElementById('collect-msg').textContent = "Доход собран!";
    setTimeout(()=>document.getElementById('collect-msg').textContent='',1200);
  });
}

// --- EXCHANGE SECTION ---
function renderExchange(area) {
  userRef.once('value', snap => {
    const d = snap.val();
    area.innerHTML = `
      <h2>Обмен</h2>
      <div class="exchange-section">
        <label>Обмен энергии на Gamma Coin</label><br>
        <input type="number" id="energy-to-gamma" placeholder="Энергия (мин 10000)">
        <button onclick="exchangeEnergyToGamma()">Обменять</button>
        <br>
        <label>Обмен Gamma Coin на Ton</label><br>
        <input type="number" id="gamma-to-ton" placeholder="Gamma Coin (мин 10000)">
        <button onclick="exchangeGammaToTon()">Обменять</button>
        <br>
        <label>Обмен Ton на Gamma Coin</label><br>
        <input type="number" id="ton-to-gamma" placeholder="Ton (мин 1)">
        <button onclick="exchangeTonToGamma()">Обменять</button>
        <br>
        <h3>Вывод средств</h3>
        <div>Выводить можно только через 100 дней после регистрации.<br>Тон кошелёк: <span id="wallet-address">${d.tonWallet||''}</span></div>
        <input type="number" id="withdraw-ton" placeholder="Сумма TON (мин 1)">
        <button onclick="withdrawTON()" ${Date.now()-d.joined<100*24*60*60*1000?'disabled':''}>Вывести</button>
        <br>
        <h3>Пополнение Ton</h3>
        <input type="number" id="deposit-ton" placeholder="Сумма TON (1-100)">
        <button onclick="depositTON()">Пополнить</button>
      </div>
    `;
  });
}
function exchangeEnergyToGamma() {
  let val = parseInt(document.getElementById('energy-to-gamma').value);
  if (val>=10000) {
    userRef.transaction(d=>{
      if (!d) return d;
      if (d.energy>=val) {
        d.energy -= val;
        d.gamma = (d.gamma||0)+Math.floor(val/10000)*10;
      }
      return d;
    },()=>{renderBalances();renderSection('exchange');});
  }
}
function exchangeGammaToTon() {
  let val = parseInt(document.getElementById('gamma-to-ton').value);
  if (val>=10000) {
    let ton = Math.floor(val/10000);
    userRef.transaction(d=>{
      if (!d) return d;
      if (d.gamma>=val) {
        d.gamma -= ton*10000;
        d.ton = (d.ton||0)+ton;
      }
      return d;
    },()=>{renderBalances();renderSection('exchange');});
  }
}
function exchangeTonToGamma() {
  let val = parseInt(document.getElementById('ton-to-gamma').value);
  if (val>=1) {
    userRef.transaction(d=>{
      if (!d) return d;
      if (d.ton>=val) {
        d.ton -= val;
        d.gamma = (d.gamma||0)+val*10000;
      }
      return d;
    },()=>{renderBalances();renderSection('exchange');});
  }
}
function withdrawTON() {
  let val = parseInt(document.getElementById('withdraw-ton').value);
  if (val>=1 && tonWallet) {
    db.ref('withdrawals').push({uid, ton:val, address:tonWallet, time:Date.now(), status:'pending'});
    showModal('Запрос на вывод отправлен! Ожидайте проверки.');
  }
}
function depositTON() {
  let val = parseInt(document.getElementById('deposit-ton').value);
  if (val>=1 && val<=100) {
    // Создание TON Connect транзакции для оплаты
    sendTonPayment(val, `Пополнение ${val} TON для ${uid}`);
  }
}

// --- TON CONNECT ОПЛАТА ---
async function sendTonPayment(amountTon, comment) {
  if (!tonConnectUI.connected) {
    alert("Сначала подключите TON кошелёк!");
    return;
  }
  const tx = {
    messages: [
      {
        address: TON_RECEIVER,
        amount: (amountTon * 1e9).toString(),
        payload: comment ? window.TonConnectUI.createCommentPayload(comment) : undefined
      }
    ]
  };
  try {
    await tonConnectUI.sendTransaction(tx);
    showModal(`<div>Транзакция отправлена! Ожидайте автоматического пополнения баланса после подтверждения платежа.</div><button onclick="closeModal()">Ок</button>`);
    // После оплаты автопроверка будет на сервере через /check-ton-payment (см. server.js)
  } catch (err) {
    showModal(`<div>Ошибка оплаты: ${err.message}</div><button onclick="closeModal()">Ок</button>`);
  }
}

// --- PREMIUM ---
document.getElementById('premium-btn').onclick = () => {
  userRef.once('value', snap => {
    const d = snap.val();
    showModal(`
      <h2>Премиум</h2>
      <div>Месяц: <b>5 TON</b></div>
      <div>Навсегда: <b>30 TON</b></div>
      <div>Текущий: ${d.premiumForever?'Навсегда':d.premium?'До '+new Date(d.premiumUntil).toLocaleDateString():'Нет'}</div>
      <button onclick="buyPremiumMonth()">Купить месяц</button>
      <button onclick="buyPremiumForever()">Купить навсегда</button>
      <button onclick="closeModal()">Отмена</button>
    `);
  });
};
function buyPremiumMonth() {
  userRef.transaction(d=>{
    if (!d) return d;
    if (d.ton>=5) {
      d.ton -= 5;
      d.premium = true;
      d.premiumUntil = Date.now()+30*24*60*60*1000;
    }
    return d;
  },()=>{renderBalances();closeModal();});
}
function buyPremiumForever() {
  userRef.transaction(d=>{
    if (!d) return d;
    if (d.ton>=30) {
      d.ton -= 30;
      d.premiumForever = true;
      d.premium = true;
      d.premiumUntil = null;
    }
    return d;
  },()=>{renderBalances();closeModal();});
}

// --- ROULETTE ENERGY ---
document.getElementById('energy-roulette-btn').onclick = () => {
  userRef.once('value', snap => {
    const d = snap.val();
    let canSpin = Date.now()-d.lastEnergyRoulette>=24*60*60*1000;
    showModal(`
      <h2>Рулетка энергии</h2>
      <div>Крутите раз в сутки! Выиграйте от 100 до 2000 энергии.</div>
      <button onclick="spinEnergyRoulette()" ${canSpin?'':'disabled'}>Крутить</button>
      <button onclick="closeModal()">Закрыть</button>
    `);
  });
};
function spinEnergyRoulette() {
  let prize = 100+Math.floor(Math.random()*1901);
  userRef.transaction(d=>{
    if (!d) return d;
    let canSpin = Date.now()-d.lastEnergyRoulette>=24*60*60*1000;
    if (canSpin) {
      d.energy = (d.energy||0)+prize;
      d.lastEnergyRoulette = Date.now();
    }
    return d;
  },()=>{
    renderBalances();
    showModal(`<div>Вы выиграли <b>${prize} энергии</b>!</div><button onclick="closeModal()">Ок</button>`);
  });
}

// --- ROULETTE LUCK ---
document.getElementById('luck-roulette-btn').onclick = () => {
  userRef.once('value', snap => {
    const d = snap.val();
    showModal(`
      <h2>Рулетка удачи</h2>
      <div>Крутите за 1 TON, шанс больше 1 TON — 1%</div>
      <button onclick="spinLuckRoulette()" ${d.ton>=1?'':'disabled'}>Крутить</button>
      <button onclick="closeModal()">Закрыть</button>
    `);
  });
};
function spinLuckRoulette() {
  let lucky = Math.random();
  let prize = lucky<0.99? (0.5+Math.random()*0.5).toFixed(2) : (1+Math.random()*4).toFixed(2);
  userRef.transaction(d=>{
    if (!d) return d;
    if (d.ton>=1) {
      d.ton -= 1;
      d.ton = +(d.ton + +prize).toFixed(2);
    }
    return d;
  },()=>{
    renderBalances();
    showModal(`<div>Вы выиграли <b>${prize} TON</b>!</div><button onclick="closeModal()">Ок</button>`);
  });
}

// --- LEADERBOARD ---
function renderLeaderboard(area) {
  db.ref('users').orderByChild('energy').limitToLast(20).once('value', snap => {
    let usersArr = [];
    snap.forEach(s => {
      let d = s.val();
      usersArr.push({ energy: d.energy||0, gamma: d.gamma||0, ton: d.ton||0, premium: d.premiumForever||d.premium, uid: s.key });
    });
    usersArr.sort((a,b)=>b.energy-a.energy);
    area.innerHTML = `<h2>Лидерборд</h2><table class="leaderboard-table">
      <tr><th>#</th><th>Баланс энергии</th><th>Gamma Coin</th><th>Ton</th><th>Премиум</th></tr>
      ${usersArr.map((u,i)=>`
      <tr>
        <td>${i+1}</td>
        <td>${u.energy}</td>
        <td>${u.gamma}</td>
        <td>${u.ton}</td>
        <td>${u.premium?'💎':''}</td>
      </tr>`).join('')}
    </table>`;
  });
}

// --- EVENTS ---
function renderEvents(area) {
  area.innerHTML = '<h2>Ивенты</h2><div>Скоро будут конкурсы и задания!</div>';
}

// --- SECTION RENDERER ---
function renderSection(section) {
  const area = document.getElementById('content-area');
  area.classList.add('fade-out');
  setTimeout(() => {
    area.innerHTML = '';
    if (section === 'shop') renderShop(area);
    else if (section === 'city') renderCity(area);
    else if (section === 'exchange') renderExchange(area);
    else if (section === 'leaderboard') renderLeaderboard(area);
    else if (section === 'events') renderEvents(area);
    area.classList.remove('fade-out');
    area.classList.add('fade-in');
    setTimeout(() => area.classList.remove('fade-in'), 330);
  }, 220);
}
