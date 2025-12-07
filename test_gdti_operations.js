const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_URL = 'http://localhost:3000/api/gdti';

// Helper to create a dummy PDF
const createDummyPdf = (filename) => {
    const filePath = path.resolve(__dirname, filename);
    fs.writeFileSync(filePath, 'Dummy PDF Content ' + Date.now());
    return filePath;
};

const runTests = async () => {
    const gdtiNumber = "GDTI-" + Date.now();
    const filePath = createDummyPdf('test_doc.pdf');
    const updatedFilePath = createDummyPdf('test_val_updated.pdf');

    try {
        console.log("=== STARTING GDTI OPERATIONS TESTS ===");

        // 1. CREATE
        console.log("\n[1] Testing CREATE...");
        const createForm = new FormData();
        createForm.append('gdtiNumber', gdtiNumber);
        createForm.append('documentType', 'Invoice');
        createForm.append('memberId', 'Member001');
        // createForm.append('metadata', JSON.stringify({ originalFileName: 'test_doc.pdf' })); // Auto-handled now
        createForm.append('document', fs.createReadStream(filePath));

        const createRes = await axios.post(`${API_URL}/create`, createForm, {
            headers: { ...createForm.getHeaders() }
        });
        console.log("CREATE Success:", createRes.data.message);
        console.log("Tx Hash:", createRes.data.transactionHash);

        // Verify Data
        console.log("Verifying data via GET...");
        const getRes1 = await axios.get(`${API_URL}/${gdtiNumber}`);
        console.log("GET Data:", getRes1.data);
        if (getRes1.data.gdtiNumber !== gdtiNumber || getRes1.data.version !== 1) {
            throw new Error("Data mismatch after CREATE");
        }

        // 2. UPDATE
        console.log("\n[2] Testing UPDATE...");
        const updateForm = new FormData();
        updateForm.append('gdtiNumber', gdtiNumber);
        updateForm.append('documentType', 'Invoice-Correction');
        updateForm.append('memberId', 'Member001'); // Original owner
        updateForm.append('updatedBy', 'UserAdmin');
        const previousVersionHash = createRes.data.transactionHash;
        // updateForm.append('previousVersionHash', previousVersionHash); // Now in URL
        updateForm.append('document', fs.createReadStream(updatedFilePath));

        const updateRes = await axios.put(`${API_URL}/update/${previousVersionHash}`, updateForm, {
            headers: { ...updateForm.getHeaders() }
        });
        console.log("UPDATE Success:", updateRes.data.message);
        console.log("New Version:", updateRes.data.version);

        // Verify Update
        const getRes2 = await axios.get(`${API_URL}/${gdtiNumber}`);
        console.log("GET Updated Data:", getRes2.data);
        if (getRes2.data.version !== 2 || getRes2.data.documentType !== 'Invoice-Correction') {
            throw new Error("Data mismatch after UPDATE");
        }

        // 3. DELETE
        console.log("\n[3] Testing DELETE...");
        const deleteRes = await axios.delete(`${API_URL}/delete`, {
            data: {
                gdtiNumber: gdtiNumber,
                deletedBy: "AdminUser",
                deletionReason: "Obsolete",
                previousVersionHash: updateRes.data.transactionHash
            }
        });
        console.log("DELETE Success:", deleteRes.data.message);

        // Verify Delete
        const getRes3 = await axios.get(`${API_URL}/${gdtiNumber}`);
        console.log("GET Deleted Data:", getRes3.data);
        if (!getRes3.data.isDeleted) {
            throw new Error("Document should be marked isDeleted: true");
        }

        console.log("\n=== ALL TESTS PASSED ===");

    } catch (error) {
        console.error("\nTEST FAILED:");
        if (error.response) {
            console.error("Status:", error.response.status);
            console.error("Data:", error.response.data);
        } else {
            console.error(error.message);
        }
    } finally {
        // Cleanup
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        if (fs.existsSync(updatedFilePath)) fs.unlinkSync(updatedFilePath);
    }
};

runTests();
