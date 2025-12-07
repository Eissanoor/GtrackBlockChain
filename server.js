const express = require('express');
const multer = require('multer');
const { Web3 } = require('web3');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const port = 3000;

// Middleware
app.use(express.json());

// Configure Multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// Setup Web3
const web3 = new Web3('http://127.0.0.1:8545');

// Helper to get Contract Instance (reloads data to handle redeployments)
const getContract = () => {
    const contractDataPath = path.resolve(__dirname, 'utils', 'contractData.json');
    const data = JSON.parse(fs.readFileSync(contractDataPath, 'utf8'));
    return new web3.eth.Contract(data.abi, data.address);
};

// Helper to calculate file hash
const calculateFileHash = (filePath) => {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);
        stream.on('data', (data) => hash.update(data));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', reject);
    });
};

// API Endpoint
// API Endpoints for GDTIDocument

// 1. CREATE Operation
app.post('/api/gdti/create', upload.single('document'), async (req, res) => {
    try {
        const { gdtiNumber, documentType, memberId } = req.body;
        const file = req.file;

        if (!file || !gdtiNumber || !documentType || !memberId) {
            return res.status(400).json({ error: 'Missing required fields: gdtiNumber, documentType, memberId, or document file.' });
        }

        console.log(`CREATE Request - GDTI: ${gdtiNumber}, Member: ${memberId}`);

        const fileHash = await calculateFileHash(file.path);

        // Auto-generate metadata from file info
        const autoMetadata = {
            originalFileName: file.originalname,
            fileSize: file.size,
            mimeType: file.mimetype,
            uploadTimestamp: Date.now()
        };

        // Prepare struct for contract
        // Struct: gdtiNumber, documentType, pdfHash, memberId, metadata
        const createParams = {
            gdtiNumber,
            documentType,
            pdfHash: fileHash,
            memberId,
            metadata: JSON.stringify(autoMetadata)
        };

        const accounts = await web3.eth.getAccounts();
        const contract = getContract();

        // Estimate Gas
        let gasEstimate;
        try {
            gasEstimate = await contract.methods.createDocument(createParams).estimateGas({ from: accounts[0] });
        } catch (error) {
            console.error("Gas estimation failed:", error.message);
            // If it fails, it might be due to existing GDTI.
            // Check existence logic can be done via helper, but we rely on contract revert.
            throw error;
        }

        // Send Transaction
        const receipt = await contract.methods.createDocument(createParams).send({
            from: accounts[0],
            gas: gasEstimate + 50000n // Buffer
        });

        res.json({
            message: 'Document created successfully',
            gdtiNumber,
            transactionHash: receipt.transactionHash,
            fileHash
        });

    } catch (error) {
        console.error('Error creating document:', error);
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
});

// 2. UPDATE Operation
app.put('/api/gdti/update/:previousVersionHash', upload.single('document'), async (req, res) => {
    try {
        const { previousVersionHash } = req.params;
        const { gdtiNumber, documentType, memberId, updatedBy } = req.body;
        const file = req.file;

        if (!gdtiNumber || !documentType || !memberId) {
            return res.status(400).json({ error: 'Missing required fields: gdtiNumber, documentType, memberId, updatedBy.' });
        }

        const contract = getContract();
        const accounts = await web3.eth.getAccounts();

        // If file provided, calc new hash, else get current (fetched from contract?)
        // Requirement implies "pdfHash: NEW hash of updated PDF".
        // If user doesn't upload a new file, do we keep old hash?
        // Usually update means "change". If no file, maybe metadata change?
        // Let's assume file is optional ONLY if we fetch old hash, but strict update usually implies file change or at least providing the hash.
        // For this API, if no file, we might error or mock.
        // Let's assume file is REQUIRED for update as per prompt "pdfHash: NEW hash".

        let pdfHash;
        if (file) {
            pdfHash = await calculateFileHash(file.path);
        } else {
            // Optional: Fetch existing if allowed, or error.
            return res.status(400).json({ error: 'New document file is required for update.' });
        }

        const updateParams = {
            gdtiNumber,
            documentType,
            pdfHash,
            memberId, // The member invoking update
            updatedBy,
            previousVersionHash: previousVersionHash || ""
        };

        const receipt = await contract.methods.updateDocument(updateParams).send({
            from: accounts[0],
            gas: 500000 // Fixed gas or estimate
        });

        res.json({
            message: 'Document updated successfully',
            gdtiNumber,
            transactionHash: receipt.transactionHash,
            version: Number(receipt.events?.DocumentUpdated?.returnValues?.version || 0) // Approximation
        });

    } catch (error) {
        console.error('Error updating document:', error);
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
});

// 3. DELETE Operation
app.delete('/api/gdti/delete', async (req, res) => {
    try {
        const { gdtiNumber, deletedBy, deletionReason, previousVersionHash } = req.body;

        if (!gdtiNumber || !deletedBy || !deletionReason) {
            return res.status(400).json({ error: 'Missing fields: gdtiNumber, deletedBy, deletionReason.' });
        }

        const contract = getContract();
        const accounts = await web3.eth.getAccounts();

        await contract.methods.deleteDocument(
            gdtiNumber,
            deletedBy,
            deletionReason,
            previousVersionHash || ""
        ).send({
            from: accounts[0],
            gas: 300000
        });

        res.json({
            message: 'Document deleted successfully',
            gdtiNumber
        });

    } catch (error) {
        console.error('Error deleting document:', error);
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
});

// 4. GET Operation
app.get('/api/gdti/:gdtiNumber', async (req, res) => {
    try {
        const { gdtiNumber } = req.params;
        const contract = getContract();

        // This relies on the manual getter I added "getDocument"
        const doc = await contract.methods.getDocument(gdtiNumber).call();

        // Transform struct to JSON
        // Web3 returns struct as object with numeric keys AND named keys.
        // We clean it up.
        const responseData = {
            gdtiNumber: doc.gdtiNumber,
            documentType: doc.documentType,
            pdfHash: doc.pdfHash,
            memberId: doc.memberId,
            createdAt: doc.createdAt.toString(),
            updatedAt: doc.updatedAt.toString(),
            version: Number(doc.version),
            metadata: doc.metadata,
            isDeleted: doc.isDeleted,
            previousVersionHash: doc.previousVersionHash,
            updatedBy: doc.updatedBy,
            deletedBy: doc.deletedBy,
            deletionReason: doc.deletionReason
        };

        res.json(responseData);

    } catch (error) {
        console.error('Error fetching document:', error);
        res.status(404).json({ error: 'Document found or error fetching.', details: error.message });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
