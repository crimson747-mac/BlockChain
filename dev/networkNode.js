const port = process.argv[2];
const currentNodeUrl = process.argv[3];

const { v1 } = require('uuid');
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
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

//새 노드를 자체 서버에 등록하고 다른 모든 네트워크 노드들로 브로드캐스트
app.post('/register-and-braodcast-node', (req, res) => {
  const { newNodeUrl } = req.body;

  //1. 새로운 노드를 받아 이를 netWorkNodes 배열에 추가
  if(bitcoin.netWorkNodes.indexOf(newNodeUrl) === -1)
    bitcoin.netWorkNodes.push(newNodeUrl);
  
  //2. 나머지 노드들에게 새로운 노드를 전파
  const regNodesPromises = [];

  bitcoin.netWorkNodes.forEach(async (networkNodeUrl) => {
    const requestOptions = {
      url: networkNodeUrl + '/register-node',
      method: 'post',
      headers: {'Content-type': 'application/json'},
      data: { newNodeUrl },
    }

    regNodesPromises.push(axios(requestOptions));
  })

  //3. 다른 노드들에 대한 정보를 새로운 노드에 전파
  Promise.all(regNodesPromises)
  .then(data => {
    const bulkRegisterOptions = {
      url: newNodeUrl + '/register-nodes-bulk',
      method: 'post',
      headers: {'Content-type': 'application/json'},
      data: {
        allNetworkNodes: [...bitcoin.netWorkNodes, bitcoin.currentNodeUrl]
      }
    }

    return axios(bulkRegisterOptions);
  })
  .then(data => {
    res.json({note: 'New Node registered with network successfully'})
  })
})

//새로운 네트워크 노드를 받아들여 등록
app.post('/register-node', (req, res) => {
  const {newNodeUrl} = req.body;
  const nodeNotAlreadyPresent = bitcoin.netWorkNodes.indexOf(newNodeUrl) === -1;
  const notCurrentNode = bitcoin.currentNodeUrl !== newNodeUrl;

  if(nodeNotAlreadyPresent && notCurrentNode)
    bitcoin.netWorkNodes.push(newNodeUrl);

  return res.json({note: 'New node registered successfully.'});
})

//한 번에 여러 노드를 등록
app.post('/register-nodes-bulk', (req, res) => {
  const {allNetworkNodes} = req.body;
  allNetworkNodes.forEach(networkNodeUrl => {

    const nodeNotAlreadyPresent = bitcoin.netWorkNodes.indexOf(networkNodeUrl) === -1;
    const notCurrentNode = bitcoin.currentNodeUrl !== networkNodeUrl;

    if(nodeNotAlreadyPresent && notCurrentNode)
      bitcoin.netWorkNodes.push(networkNodeUrl);
  })

  return res.json({note: 'Bulk registeration successfull.'});
})

app.listen(port, () => {
  console.log(`http://localhost:${port}`);
});