const sha256 = require('sha256');

function BlockChain() {
  this.chain = []; // 채굴한 모든 블록이  배열 안에 체인으로 저장
  this.pendingTransactions = []; // 블록에 아직 저장되지 않은 모든 트랜잭션을 저장
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
    recipient: recipient
  };

  this.pendingTransactions.push(newTransaction);

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
 * @returns 
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

module.exports = BlockChain;