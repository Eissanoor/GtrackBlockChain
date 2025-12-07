// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract DocumentStore {
    struct GDTIDocument {
        string gdtiNumber;
        string documentType;
        string pdfHash;
        string memberId;
        uint256 createdAt;
        uint256 updatedAt;
        uint256 version;
        string metadata; // JSON string for flexibility
        bool isDeleted;
        string previousVersionHash;
        string updatedBy; // Added based on requirements
        string deletedBy; // Added based on requirements
        string deletionReason; // Added based on requirements
    }

    // Mapping from gdtiNumber to the Document
    mapping(string => GDTIDocument) private gdtiDocuments;
    // Mapping to check if a GDTI number exists (can be inferred from gdtiDocuments, but explicit check is good)
    mapping(string => bool) public gdtiExists;

    // Events
    event DocumentCreated(string indexed gdtiNumber, string memberId, uint256 timestamp);
    event DocumentUpdated(string indexed gdtiNumber, uint256 version, uint256 timestamp);
    event DocumentDeleted(string indexed gdtiNumber, string deletedBy, uint256 timestamp);

    struct CreateDocParams {
        string gdtiNumber;
        string documentType;
        string pdfHash;
        string memberId;
        string metadata;
    }

    function createDocument(CreateDocParams calldata params) public {
        require(!gdtiExists[params.gdtiNumber], "Document with this GDTI Number already exists.");
        
        GDTIDocument storage newDoc = gdtiDocuments[params.gdtiNumber];
        newDoc.gdtiNumber = params.gdtiNumber;
        newDoc.documentType = params.documentType;
        newDoc.pdfHash = params.pdfHash;
        newDoc.memberId = params.memberId;
        newDoc.createdAt = block.timestamp;
        newDoc.updatedAt = block.timestamp;
        newDoc.version = 1;
        newDoc.metadata = params.metadata;
        newDoc.isDeleted = false;
        // previousVersionHash is empty string by default
        // updatedBy is empty string by default
        // deletedBy is empty string by default
        // deletionReason is empty string by default

        gdtiExists[params.gdtiNumber] = true;

        emit DocumentCreated(params.gdtiNumber, params.memberId, block.timestamp);
    }

    struct UpdateDocParams {
        string gdtiNumber;
        string documentType;
        string pdfHash;
        string memberId;
        string updatedBy;
        string previousVersionHash;
    }

    function updateDocument(UpdateDocParams calldata params) public {
        require(gdtiExists[params.gdtiNumber], "Document does not exist.");
        require(!gdtiDocuments[params.gdtiNumber].isDeleted, "Cannot update a deleted document.");

        GDTIDocument storage doc = gdtiDocuments[params.gdtiNumber];

        doc.documentType = params.documentType;
        doc.pdfHash = params.pdfHash;
        doc.updatedAt = block.timestamp;
        doc.version++;
        doc.previousVersionHash = params.previousVersionHash;
        doc.updatedBy = params.updatedBy;
        doc.memberId = params.memberId; 

        emit DocumentUpdated(params.gdtiNumber, doc.version, block.timestamp);
    }

    function deleteDocument(
        string memory _gdtiNumber,
        string memory _deletedBy,
        string memory _deletionReason,
        string memory _previousVersionHash
    ) public {
        require(gdtiExists[_gdtiNumber], "Document does not exist.");
        require(!gdtiDocuments[_gdtiNumber].isDeleted, "Document is already deleted.");

        GDTIDocument storage doc = gdtiDocuments[_gdtiNumber];

        doc.isDeleted = true;
        doc.deletedBy = _deletedBy;
        doc.deletionReason = _deletionReason;
        doc.previousVersionHash = _previousVersionHash;
        
        emit DocumentDeleted(_gdtiNumber, _deletedBy, block.timestamp);
    }

    // Manual getter returning struct - if this fails stack, return tuple
    function getDocument(string memory _gdtiNumber) public view returns (GDTIDocument memory) {
         require(gdtiExists[_gdtiNumber], "Document does not exist.");
         return gdtiDocuments[_gdtiNumber];
    }
}
