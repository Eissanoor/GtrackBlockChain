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
app.post('/api/pos', upload.single('document'), async (req, res) => {
    try {
        const { memberId, documentType } = req.body;
        const file = req.file;

        if (!file || !memberId || !documentType) {
            return res.status(400).json({ error: 'Missing required fields: memberId, documentType, or document file.' });
        }

        console.log(`Received upload for Member: ${memberId}, Type: ${documentType}`);

        // Calculate file hash
        const fileHash = await calculateFileHash(file.path);
        console.log(`File Hash: ${fileHash}`);

        // Get accounts
        const accounts = await web3.eth.getAccounts();
        const account = accounts[0];

        // Get Contract (fresh instance)
        const contract = getContract();

        // Estimate Gas first to see if it reverts
        let gasEstimate;
        try {
            gasEstimate = await contract.methods.addDocument(memberId, documentType, fileHash).estimateGas({ from: account });
            console.log(`Gas Estimate: ${gasEstimate}`);
        } catch (error) {
            console.error("Gas estimation failed. The transaction will likely revert.");
            console.error("Reason:", error.message);
            // Try to get more info
            if (error.data) {
                console.error("Error Data:", error.data);
            }
            throw error;
        }

        // Store on Blockchain
        const receipt = await contract.methods.addDocument(memberId, documentType, fileHash).send({
            from: account,
            gas: gasEstimate + 50000n // Add buffer
        });

        console.log('Transaction successful:', receipt.transactionHash);

        res.json({
            message: 'Document stored successfully',
            transactionHash: receipt.transactionHash,
            fileHash: fileHash,
            filePath: file.path
        });

    } catch (error) {
        console.error('Error processing request:', error);
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
