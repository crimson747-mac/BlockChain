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
  const {newTransaction} = req.body;
  const blockIndex = bitcoin.addTransactionToPendingTransactions(newTransaction);

  return res.json({note: `Transaction will be added in block ${blockIndex}`})
});

app.post('/transaction/broadcast', (req, res) => {
  const {amount, sender, recipient} = req.body;
  const newTransaction = bitcoin.createNewTransaction(amount, sender, recipient);
  bitcoin.addTransactionToPendingTransactions(newTransaction);

  const requestPromises = [];
  bitcoin.netWorkNodes.forEach(networkNodeUrl => {
    const requestOptions = {
      url: networkNodeUrl + '/transaction',
      method: 'post',
      headers: {'Content-Type': 'application/json'},
      data: {newTransaction}
    }

    requestPromises.push(axios(requestOptions));
  })

  Promise.all(requestPromises)
  .then(data => {
    return res.json({note: 'Transaction created an broadcast successfully'});
  })
});

app.get('/mine', (req, res) => {
  // 1. 블록 생성
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

  // 2. 블록 전파
  const requestPromises = [];
  bitcoin.netWorkNodes.forEach(networkNodeUrl => {
    const requestOptions = {
      url: networkNodeUrl + '/receive-new-block',
      method: 'post',
      headers: {'Content-Type': 'application/json'},
      data: { newBlock }
    }
    requestPromises.push(axios(requestOptions));
  })

  // 3. 채굴보상 트랜잭션 전파
  Promise.all(requestPromises)
  .then(data => {
    const requestOptions = {
      url: bitcoin.currentNodeUrl + '/transaction/broadcast',
      method: 'post',
      headers: {'Content-Type': 'application/json'},
      data: {
        amount: 12.5,
        sender: "00",
        recipient: nodeAddress
      }
    }

    return axios(requestOptions);
  })

  return res.json({
    note: "New block mined & broadcast successfully",
    block: newBlock
  })
});

app.post('/receive-new-block', (req, res) => {
  const {newBlock} = req.body;
  const lastBlock = bitcoin.getLastBlock();

  const correctHash = lastBlock.hash === newBlock.previousBlockHash;
  const correctIndex = lastBlock['index'] + 1 === newBlock['index'];

  if(correctHash && correctIndex) {
    bitcoin.chain.push(newBlock);
    bitcoin.pendingTransactions = [];

    return res.json({
      note: 'New Block received and accepted.',
      newBlock: newBlock
    })
  } else {
    res.json({
      note: 'New Block rejected.',
      newBlock: newBlock
    })
  }
})

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

app.get('/consensus', (req, res) => {
  const requestPromises = [];

  // 블록체인 네트워크의 다른 모든 노드들에 요청을 보내 그들의 블록체인 복사본을 가져와
  // 현재의 노드에 있는 플록체인 복사본과 비교한다.
  bitcoin.netWorkNodes.forEach(networkNodeUrl => {
    const requestOptions = {
      url: networkNodeUrl + '/blockchain',
      method: 'get',
      headers: {'Content-Type': 'application/json'}
    };
    requestPromises.push(axios(requestOptions));
  });

  Promise.all(requestPromises)
  .then(blockchains => {
    const currentChainLength = bitcoin.chain.length;
    let maxChainLength = currentChainLength;
    let newLongestChain = null;
    let newPendingTransactions = null;

    blockchains.forEach(({data: blockchain}) => {
      console.log(blockchain);

      if(blockchain.chain.length > maxChainLength) {
        maxChainLength = blockchain.chain.length;
        newLongestChain = blockchain.chain;
        newPendingTransactions = blockchain.pendingTransactions;
      }
    })

    if(
      !newLongestChain || // 새롭게 갱신된 longest chain 이 없거나(현재 노드의 블록이 최장)
      (newLongestChain && !bitcoin.chainIsValid(newLongestChain)) // 새로 갱신된 체인이 적접하지 않다면,
    ) {
      return res.json({
        note: 'Current chain has not been replaced'
      })
    } else {
      bitcoin.chain = newLongestChain;
      bitcoin.pendingTransactions = newPendingTransactions;

      return res.json({
        note: 'This chain has been replaced',
        chain: bitcoin.chain
      })
    }
  })
})

app.listen(port, () => {
  console.log(`http://localhost:${port}`);
});