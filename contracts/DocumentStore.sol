// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract DocumentStore {
    struct Document {
        string memberId;
        string documentType;
        string fileHash;
        uint256 timestamp;
    }

    // Mapping from memberId to list of Documents
    mapping(string => Document[]) public memberDocuments;

    event DocumentAdded(string indexed memberId, string documentType, string fileHash, uint256 timestamp);

    function addDocument(string memory _memberId, string memory _documentType, string memory _fileHash) public {
        Document memory newDoc = Document({
            memberId: _memberId,
            documentType: _documentType,
            fileHash: _fileHash,
            timestamp: block.timestamp
        });

        memberDocuments[_memberId].push(newDoc);

        emit DocumentAdded(_memberId, _documentType, _fileHash, block.timestamp);
    }

    function getDocuments(string memory _memberId) public view returns (Document[] memory) {
        return memberDocuments[_memberId];
    }
}
