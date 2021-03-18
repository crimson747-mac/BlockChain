const { v1 } = require('uuid');
const express = require('express');
const bodyParser = require('body-parser');
const BlockChain = require('./blockchain');

const app = express();
const bitcoin = new BlockChain();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

app.get('/blockchain', (req, res) => {
  res.send(bitcoin);
});

app.post('/transaction', (req, res) => {
  const {amount, sender, recipient} = req.body;
  const blockIndex = bitcoin.createNewTransaction(amount, sender, recipient);

  return res.json({ note: `Transaction will be added in block ${blockIndex}.`});
});

app.get('/mine', (req, res) => {
  const lastBlock = bitcoin.getLastBlock();
  const previousBlockHash = lastBlock['hash'];
  const currentBlockData = {
    transactions: bitcoin.pendingTransactions,
    index: lastBlock['index'] + 1
  };

  const nonce = bitcoin.proofOfWork(previousBlockHash, currentBlockData);
  const blockHash = bitcoin.hashBlock(previousBlockHash, currentBlockData, nonce);

  const nodeAddress = v1().split('-').join('');
  bitcoin.createNewTransaction(12.5, "00", nodeAddress);

  const newBlock = bitcoin.createNewBlock(nonce, previousBlockHash, blockHash);

  return res.json({
    note: "New block mined successfully",
    block: newBlock
  })
});

app.listen(5000, () => {
  console.log('http://localhost:5000');
});