// server.js
const express = require('express');
const admin = require('firebase-admin');
const axios = require('axios');
const app = express();

// Подключите Firebase Admin SDK (выгрузите ключ через консоль Firebase или используйте переменные окружения Render)
admin.initializeApp({ credential: admin.credential.applicationDefault(), databaseURL: "https://gammaton-fdbfd-default-rtdb.firebaseio.com" });

// Проверка TON-платежей (используется TON Center API)
const TON_API_KEY = "0deb985bebeb8023b954a40bdb556073bb5eaa081f5fa49a58b43ee733eb18ff";
const TON_RECEIVER = "UQAmTM_EE8D6seecLKf-h8aXVQasliniDDQ52EvBj7PqExNr";

// Проверка входящего платежа по uid и сумме
app.get('/check-ton-payment', async (req, res) => {
  const { uid, amount } = req.query;
  if (!uid || !amount) return res.json({ ok: false, error: "No uid or amount" });

  try {
    // Получить адрес пользователя из Firebase
    const snap = await admin.database().ref('users/' + uid + '/tonWallet').once('value');
    const senderWallet = snap.val();
    if (!senderWallet) return res.json({ ok: false, error: "No wallet" });

    // Получить последние входящие транзакции на TON_RECEIVER
    const txs = await axios.get(`https://toncenter.com/api/v2/getTransactions?address=${TON_RECEIVER}&limit=30&api_key=${TON_API_KEY}`);
    const found = txs.data.transactions.find(tx =>
      tx.in_msg.source === senderWallet &&
      Number(tx.in_msg.value) >= amount * 1e9
    );

    if (found) {
      // Найден платеж — начислить TON пользователю
      await admin.database().ref('users/' + uid + '/ton').transaction(v => (v||0) + Number(amount));
      return res.json({ ok: true, tx: found.transaction_id });
    } else {
      return res.json({ ok: false, error: "Not found" });
    }
  } catch (err) {
    return res.json({ ok: false, error: err.message });
  }
});

app.listen(3000, () => console.log('Server started on port 3000'));
