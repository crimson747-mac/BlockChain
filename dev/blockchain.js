const currentNodeUrl = process.argv[3];

const sha256 = require('sha256');
const {v1} = require('uuid');

function BlockChain() {
  this.chain = []; // 채굴한 모든 블록이  배열 안에 체인으로 저장
  this.pendingTransactions = []; // 블록에 아직 저장되지 않은 모든 트랜잭션을 저장

  this.currentNodeUrl = currentNodeUrl;
  this.netWorkNodes = [];

  this.createNewBlock(100, '0', '0');
}

/**
 * 새로운 블럭을 생성
 * @param {number} nonce: 자격증명에서 온 값으로 어떠한 숫자 값 => proofOfWork 메서드를 통해 적법하게 새로운 블럭을 반들었다는 증거 
 * @param {string} previousBlockHash: 이전 블록의 데이터를 해싱한 값
 * @param {string} hash: 새로운 트랜잭션을 해시화하여 압축한 값
 */
BlockChain.prototype.createNewBlock = function(nonce, previousBlockHash, hash) {
    const newBlock = {
      index: this.chain.length + 1, // 몇 번째 블럭인지 인덱스 표시
      timestamp: Date.now(), // 블럭이 생성성된 시점
      transactions: this.pendingTransactions, // 블록 생성시 새로운 or 미결 트랜잭션을 저장
      nonce: nonce,
      hash: hash,
      previousBlockHash: previousBlockHash,
    };

    // 새로운 블럭 생성 후 기존의 트랜잭션 초기화
    this.pendingTransactions = [];
    this.chain.push(newBlock);
    
    return newBlock;
}

/**
 * 마지막 블록을 반환
 * @returns: block
 */
BlockChain.prototype.getLastBlock = function() {
  return this.chain[this.chain.length - 1];
}

/**
 * 새로운 트랜잭션 생성: 트랜잭션은 블록을 생성할 때 검증되고, 확정되고, 블록체인에 기록된다.
 * @param {number} amount: 트랜잭션을 통해 송금하는 양
 * @param {string} sender: 발송인의 주소
 * @param {string} recipient: 수신자의 주소
 * @returns: 새로운 트랜잭션이 추가될 블록의 넘버
 */
BlockChain.prototype.createNewTransaction = function(amount, sender, recipient) {
  const newTransaction = {
    amount: amount,
    sender: sender,
    recipient: recipient,
    transactionId: v1().split('-').join('')
  };

  return newTransaction;
}

BlockChain.prototype.addTransactionToPendingTransactions = function(transactionObj) {
  this.pendingTransactions.push(transactionObj);

  return this.getLastBlock()['index'] + 1;
}

/**
 * 블록에 대한 해시값을 반환
 * @param {string} previousBlockHash: 이전 블록의 데이터를 해싱한 값
 * @param {object} currentBlockData: 현재 블록의 데이터
 * @param {number} nonce: 자격증명에서 온 값으로 어떠한 숫자 값
 */
BlockChain.prototype.hashBlock = function(previousBlockHash, currentBlockData, nonce) {
  // 모든 데이터를 단일 문자열로 변경
  const dataAsString = previousBlockHash + nonce.toString() + JSON.stringify(currentBlockData);

  const hash = sha256(dataAsString);

  return hash;
}

/**
 * 작업 증명: 블럭의 적법성 검증을 수행
 * @param {string} previousBlockHash: 이전 블럭의 해시
 * @param {string} currentBlockData: 현재 블럭의 데이터
 * @returns: 증명에 성공한 임의의 숫자
 */
BlockChain.prototype.proofOfWork = function(previousBlockHash, currentBlockData) {
  let nonce = 0;

  let hash = this.hashBlock(previousBlockHash, currentBlockData, nonce);

  while(hash.substring(0, 4) !== '0000') {
    nonce++;
    hash = this.hashBlock(previousBlockHash, currentBlockData, nonce);
  }

  return nonce;
}

/**
 * 블록체인 검증: 네크워트 내의 다른 체인들을 현재 노드의 체인과 비교함으로써 검증한다.
 * - 블록체인 내의 모든 블록의 순회하며 해당 블록의 previousBlockHash 속성이 이전의 블록 hash 와 정활히 일치하는지 확인
 * @param {object} blockchain 
 */
BlockChain.prototype.chainIsValid = function(blockchain) {
  let validChain = true;

  for(let i = 1; i < blockchain.length; i++) {
    // 1. 모든 해시값이 제대로 정렬되어 있는지 검증
    const currentBlock = blockchain[i];
    const prevBlock  = blockchain[i -1];

    if(currentBlock['previousBlockHash'] !== prevBlock['hash']) {
      validChain = false;
    }

    // 2. 각 블록의 blockHash 값이 0000 으로 시작하는지 검증
    const blockHash = this.hashBlock(
      prevBlock['hash'],
      { transactions: currentBlock['transactions'], index: currentBlock['index'] },
      currentBlock['nonce']
    );

    if(blockHash.substring(0, 4) !== '0000') {
      validChain = false;
    }

    // 3. 제네시스 블록 검증
    const genesisBlock = blockchain[0];
    const isCorrectNonce = genesisBlock['nonce'] === 100;
    const isCorrectPreviousBlockHash = genesisBlock['previousBlockHash'] === '0';
    const isCorrectHash = genesisBlock['hash'] === '0'

    if(!isCorrectNonce || !isCorrectPreviousBlockHash || !isCorrectHash) {
      validChain = false;
    }
  }

  return validChain;
}

/// FrontEnd
BlockChain.prototype.getBlock = function(blockHash) {
  let isCorrectBlock = null;

  this.chain.forEach(block => {
    if(block.hash === blockHash)  correctBlock = block;
  });

  return isCorrectBlock;
}

BlockChain.prototype.getTransaction = function(transactionId) {
  let isCorrectTransaction = null;
  let isCorrectBlock = null;
  this.chain.forEach(block => {
    block.transactions.forEach(transaction => {
      if(transaction.transactionId === transactionId) {
        isCorrectTransaction = transaction;
        isCorrectBlock = block;
      }
    })
  })

  return {
    transaction: isCorrectTransaction,
    block: isCorrectBlock
  };
}

BlockChain.prototype.getAddressData = function(address) {
  const addressTransactions = [];

  this.chain.forEach(block => {
    block.transactions.forEach(transaction => {
      if(transaction.sender === address || transaction.recipient === address) {
        addressTransactions.push(transaction);
      }
    })
  })

  let balance = 0;
  addressTransactions.forEach(transaction => {
    if(transaction.recipient === address) balance += transaction.amount;
    else if(transaction.sender === address) balance -= transaction.amount;
  })

  return {
    addressTransactions: addressTransactions,
    addressBalance: balance
  }
}


module.exports = BlockChain;