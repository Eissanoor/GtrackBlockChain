const fs = require('fs');
const path = require('path');
const solc = require('solc');
const { Web3 } = require('web3');
const ganache = require('ganache');

// This function is not used but kept for reference or future use
const deploy = async () => {
    const contractPath = path.resolve(__dirname, 'contracts', 'DocumentStore.sol');
    const source = fs.readFileSync(contractPath, 'utf8');

    const input = {
        language: 'Solidity',
        sources: {
            'DocumentStore.sol': {
                content: source,
            },
        },
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
            },
            outputSelection: {
                '*': {
                    '*': ['*'],
                },
            },
        },
    };

    const output = JSON.parse(solc.compile(JSON.stringify(input)));

    if (output.errors) {
        output.errors.forEach(err => {
            console.error(err.formattedMessage);
        });
        if (output.errors.some(err => err.severity === 'error')) {
            process.exit(1);
        }
    }

    const contractFile = output.contracts['DocumentStore.sol']['DocumentStore'];
    const abi = contractFile.abi;
    const bytecode = contractFile.evm.bytecode.object;

    const provider = ganache.provider();
    const web3 = new Web3(provider);
    const accounts = await web3.eth.getAccounts();
    const account = accounts[0];

    console.log('Deploying from account:', account);

    const contract = new web3.eth.Contract(abi);

    const deployTx = contract.deploy({
        data: bytecode,
    });

    const gas = await deployTx.estimateGas({ from: account });
    const instance = await deployTx.send({
        from: account,
        gas: gas,
        gasPrice: '1000000000'
    });

    console.log('Contract deployed at address:', instance.options.address);
};

const deployToLocalhost = async () => {
    const contractPath = path.resolve(__dirname, 'contracts', 'DocumentStore.sol');
    const source = fs.readFileSync(contractPath, 'utf8');

    const input = {
        language: 'Solidity',
        sources: {
            'DocumentStore.sol': {
                content: source,
            },
        },
        settings: {
            evmVersion: 'paris', // Force EVM version to Paris
            outputSelection: {
                '*': {
                    '*': ['*'],
                },
            },
        },
    };

    const output = JSON.parse(solc.compile(JSON.stringify(input)));
    if (output.errors) {
        output.errors.forEach(err => {
            console.error(err.formattedMessage);
        });
        if (output.errors.some(err => err.severity === 'error')) {
            process.exit(1);
        }
    }

    const contractFile = output.contracts['DocumentStore.sol']['DocumentStore'];
    const abi = contractFile.abi;
    const bytecode = contractFile.evm.bytecode.object;

    // Connect to localhost:8545
    const web3 = new Web3('http://127.0.0.1:8545');

    try {
        const accounts = await web3.eth.getAccounts();
        if (accounts.length === 0) {
            console.error("No accounts found. Is Ganache running?");
            process.exit(1);
        }
        const account = accounts[0];
        console.log('Deploying from account:', account);

        const contract = new web3.eth.Contract(abi);
        const deployTx = contract.deploy({ data: bytecode });
        const gas = await deployTx.estimateGas({ from: account });
        const instance = await deployTx.send({
            from: account,
            gas: gas,
        });

        console.log('Contract deployed at:', instance.options.address);

        const config = {
            address: instance.options.address,
            abi: abi
        };

        fs.writeFileSync(path.resolve(__dirname, 'utils', 'contractData.json'), JSON.stringify(config, null, 2));
        console.log('Contract data saved to utils/contractData.json');

    } catch (e) {
        console.error("Failed to connect or deploy:", e);
    }
};

deployToLocalhost();
