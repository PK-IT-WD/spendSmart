const express = require('express');
const path = require('path');
const { Sequelize, DataTypes } = require('sequelize');
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
const braintree = require('braintree');

const app = express();

const sequelize = new Sequelize('spendSmart', 'root', '2001', {
    host: 'localhost',
    dialect: 'mysql',
});

const userDetails = sequelize.define('userDetails', {

    userName: {
        type: DataTypes.STRING,
        allowNull: false
    },

    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },

    password: {
        type: DataTypes.STRING,
        allowNull: false
    }

});

const Expense = sequelize.define('Expense', {

    userID: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: userDetails,
            key: 'id'
        }
    },

    category: {
        type: DataTypes.STRING,
        allowNull: false
    },

    description: {
        type: DataTypes.STRING,
        allowNull: false
    },

    amount: {
        type: DataTypes.DECIMAL,
        allowNull: false
    }

});

const orders = sequelize.define('orders', {

    userID: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: userDetails,
            key: 'id',
        }
    },

    orderID: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true,
    },

    amount: {
        type: DataTypes.DECIMAL,
        allowNull: false,
    },

    paymentStatus: {
        type: DataTypes.ENUM('pending', 'success', 'failed'),
        defaultValue: 'pending',
        allowNull: false
    }

});

userDetails.hasMany(Expense, { foreignKey: 'userID' });
Expense.belongsTo(userDetails, { foreignKey: 'userID' });

userDetails.hasMany(orders, { foreignKey: 'userID' });
orders.belongsTo(userDetails, { foreignKey: 'userID' });


sequelize.sync({alter: true}).then(() => {
    console.log('Database synchronized');
}).catch(err => {
    console.log('Error syncing database:', err);
});

const gateway = new braintree.BraintreeGateway({
    environment: braintree.Environment.Sandbox,
    merchantId: '5yyrhcs4b2wbjx4b',
    publicKey: 'j3nj7tw7drcfvvbm',
    privateKey: '9d1b785af33f80512cd98155866cca34'
});

app.use(express.static(path.join(__dirname, '../', 'frontend')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {

    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));

});

app.post('/login', async (req, res) => {

    const body = req.body;

    try {

        const user = await userDetails.findOne({ where: { email: body.email } });
        if (user) {

            const validPassword = bcryptjs.compareSync(body.password, user.password);

            if (validPassword) {

                const token = jwt.sign({ userID: user.id }, 'secretKey', { expiresIn: '7d' });

                const premiumOrder = await orders.findOne({
                    where: { userID: user.id, paymentStatus: 'success' },
                    order: [['createdAt', 'DESC']], // Get the latest successful payment
                });

                const premiumUser = !!premiumOrder; // True if a successful payment exists

                res.status(200).json({ success: true, token, premiumUser });

            } else {

                res.status(401).send({ success: false, message: 'User not authorised' });

            }

        } else {

            res.status(404).send({ success: false, message: 'User not found' });

        }

    } catch (err) {

        res.status(500).send({ success: false, message: 'Database error' });

    }
});

app.post('/signup', async (req, res) => {

    const body = req.body;

    try {

        const registeredUser = await userDetails.findOne({ where: { email: body.email } });

        if (!registeredUser) {

            const salt = bcryptjs.genSaltSync(10);
            const encryptedPassword = bcryptjs.hashSync(body.password, salt);

            const newUser = await userDetails.create({
                userName: body.userName,
                email: body.email,
                password: encryptedPassword,
            });

            res.status(200).json({ success: true, newUser });

        } else {

            res.status(400).json({ success: false, message: 'User Already exists' });

        }
    } catch (err) {

        res.status(500).json({ success: false, message: 'User details not added' });

    }

});

app.post('/addExpense', async (req, res) => {

    const token = req.headers['authorization'];

    if (!token) return res.status(403).send({ success: false, message: 'No token provided' });

    try {

        const tokenParts = token.split(' ');
        const decoded = jwt.verify(tokenParts[1], 'secretKey');
        const body = req.body;

        await Expense.create({
            category: body.category,
            description: body.description,
            amount: body.amount,
            userID: decoded.userID,
        });

        res.status(200).json({ success: true, message: 'Expense added' });

    } catch (err) {

        res.status(500).json({ success: false, message: 'Expense not added' });

    }

});

app.delete('/deleteExpense/:id', async (req, res) => {

    const token = req.headers['authorization'];

    if (!token) return res.status(404).send({ success: false, message: 'No token provided' });

    try {

        const tokenParts = token.split(' ');
        const decoded = jwt.verify(tokenParts[1], 'secretKey');
        
        const expense = await Expense.findOne({ where: { id: req.params.id, userID: decoded.userID } });
        if (!expense) return res.status(404).send({ success: false, message: 'Expense not found' });

        await Expense.destroy({ where: { id: req.params.id } });
        res.status(200).json({ success: true, message: 'Expense deleted' });

    } catch (err) {

        res.status(500).json({ success: false, message: 'Error deleting expense' });

    }

});

app.get('/allExpense', async (req, res) => {

    const token = req.headers['authorization'];

    if (!token) return res.status(403).send({ success: false, message: 'No token provided' });

    try {

        const tokenParts = token.split(' ');
        const decoded = jwt.verify(tokenParts[1], 'secretKey');

        const updatedExpense = await Expense.findAll({ where: { userID: decoded.userID } });

        res.status(200).json({ success: true, updatedExpense });

    } catch (err) {

        res.status(500).json({ success: false, message: 'Error fetching expenses' });

    }

});

app.get('/premiumMembership', async (req, res) => {

    try {

        const createToken = await gateway.clientToken.generate({});
        const paymentDetails = {
            amount: '200.00'
        }
        res.status(200).json({success: true, clientToken: createToken.clientToken, paymentDetails});

    } catch (err) {

        res.status(500).json({success: false, message: 'Error on create token'});
        
    }

});

app.post('/createTransaction', async (req, res) => {

    const {nonce, amount} = req.body;
    const token = req.headers['authorization'];

    const tokenParts = token.split(' ');
    const decoded = jwt.verify(tokenParts[1], 'secretKey');

    try {

        const result = await gateway.transaction.sale({
            amount: amount,
            paymentMethodNonce: nonce,
            options: {
                submitForSettlement: true
            }
        });

        if (result.success) {

            await orders.create({
                userID: decoded.userID,
                orderID: result.transaction.id,
                amount: amount,
                paymentStatus: 'success'
            })
            return res.status(200).json({success: true, transaction: result.transaction});

        } else {

            await orders.create({
                userID: decoded.userID,
                orderID: result.transaction.id,
                amount: amount,
                paymentStatus: 'failure'
            })
            return res.status(400).json({success: false, transaction: result.transaction});

        }

    } catch (err) {

        console.log(err);

    }

})

app.get('/premiumUser', async (req, res) => {
    try {
        const token = req.headers['authorization'];
        if (!token) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const tokenParts = token.split(' ');
        const decoded = jwt.verify(tokenParts[1], 'secretKey');

        const premiumUser = await orders.findOne({
            where: { userID: decoded.userID },
            order: [['createdAt', 'DESC']]
        });

        if (premiumUser && premiumUser.paymentStatus === 'success') {
            return res.status(200).json({ success: true });
        } else if (!premiumUser) {
            return res.status(200).json({ success: null });
        } else {
            return res.status(200).json({ success: false });
        }
    } catch (err) {
        console.error('Error in /premiumUser:', err);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});


const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
