const express = require('express');
const path = require('path');
const fs = require('fs');
const { Sequelize, DataTypes, Op } = require('sequelize');
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
const braintree = require('braintree');
const SibApiV3Sdk = require('sib-api-v3-sdk');
const {v4: uuidv4} = require('uuid');
const {S3Client, PutObjectCommand, CreateBucketCommand, HeadBucketCommand} = require('@aws-sdk/client-s3');
const moment = require('moment');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const app = express();
app.use(helmet());

const logStream = fs.createWriteStream(path.join(__dirname, 'access.log'),{flags: 'a'});
app.use(morgan('combined', {stream: logStream}));  

app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://js.braintreegateway.com"],
    },
  })
);

const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ID,
        secretAccessKey: process.env.AWS_KEY
    }
});

const checkBucket = async (bucketName) => {
    try {
        await s3.send(new HeadBucketCommand({Bucket: bucketName}));
    } catch (err) {
        if (err.name === 'NotFound') {
            try {
                await s3.send(
                    new CreateBucketCommand({
                        Bucket: bucketName,
                        CreateBucketConfiguration: {
                            LocationConstraint: process.env.AWS_REGION
                        }
                    })
                )
            } catch (creationError) {
                bucketError(Error);
            }
        } else {
            bucketError(err);
        }
    }
}

const bucketError = (error) => {
    const filePath = path.join(__dirname, 'database-error.txt');
    const errorMessage = `[${new Date.toISOString()}] ${error.name}: ${error.message}\nStack Trace: ${error.stack}\n\n`;
    fs.appendFile(filePath, errorMessage, (err) => {
        if (err) {
            console.error('Failed to write a bucket error file', err);
        }
    });
}

const s3Upload = async (bucketName, keyName, data) => {
    try {
        const region = process.env.AWS_REGION
        const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: keyName,
        Body: JSON.stringify(data),
        ContentType: 'application/json',
      });
  
      await s3.send(command);
      return `https://${bucketName}.s3.${region}.amazonaws.com/${keyName}`;
    } catch (err) {
      console.error('Error uploading file to S3:', err);
      throw err;
    }
  }

const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
const apiKey = SibApiV3Sdk.ApiClient.instance.authentications['api-key'];
apiKey.apiKey = process.env.SBI_KEY;

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        dialect: process.env.DB_DIALECT,
        port: process.env.DB_PORT || 3306,
    }
);

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
    },
    totalExpense: {
        type: DataTypes.DECIMAL,
        defaultValue: 0
    }
});

const Transaction = sequelize.define('Transaction', {
    userID: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: userDetails,
            key: 'id'
        }
    },
    date: {
        type: DataTypes.DATE,
        allowNull: false,
    },
    description: {
        type: DataTypes.STRING,
        allowNull: false
    },
    category: {
        type: DataTypes.STRING,
        allowNull: false
    },
    transactionType: {
        type: DataTypes.ENUM('expense', 'income'),
        allowNull: false,
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

const forgotPassword = sequelize.define('forgotPassword', {
    UUID: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },
    userID: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: userDetails,
            key: 'id'
        }
    },
    active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    }
});

const Link = sequelize.define('Link', {
    userID: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: userDetails,
            key: 'id'
        }
    },
    link: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    }
});

userDetails.hasMany(Transaction, { foreignKey: 'userID' });
Transaction.belongsTo(userDetails, { foreignKey: 'userID' });

userDetails.hasMany(orders, { foreignKey: 'userID' });
orders.belongsTo(userDetails, { foreignKey: 'userID' });

userDetails.hasMany(forgotPassword, { foreignKey: 'userID'});
forgotPassword.belongsTo(userDetails, { foreignKey: 'userID'});

sequelize.sync({ alter: true })
    .then(() => {
        console.log('Database synchronized');
    })
    .catch(err => {
        databaseError(err);
    });

const databaseError = (error) => {
    const databaseError = process.env.DATABASE_ERROR;
    const filePath = path.join(__dirname, databaseError);
    const errorMessage = `[${new Date().toISOString()}] Error: ${error.message}\nStack Trace: ${error.stack}\n\n`;
    fs.appendFile(filePath, errorMessage, (err) => {
        if (err) {
            console.error('Failed to write database error to file:', err);
        }
    });
};

const gateway = new braintree.BraintreeGateway({
    environment: process.env.ENVIRONMENT,
    merchantId: process.env.MERCHANT_ID,
    publicKey: process.env.PUBLIC_KEY,
    privateKey: process.env.PRIVATE_KEY
});

Transaction.addHook('afterCreate', async (expense, options) => {
    const transaction = options.transaction;

    if (expense.transactionType === 'expense') {
        const user = await userDetails.findByPk(expense.userID, {transaction});
        if (user) {
            user.totalExpense = parseFloat(user.totalExpense) + parseFloat(expense.amount);
            await user.save({transaction});
        }
    }
});

Transaction.addHook('afterUpdate', async (expense, options) => {
    const transaction = options.transaction;
    const previous = expense._previousDataValues.amount;
    const current = expense.amount;
    
    if (previous !== current) {
        const user = await userDetails.findByPk(expense.userID, {transaction});
        if (user) {
            user.totalExpense = parseFloat(user.totalExpense) - parseFloat(previous) + parseFloat(current);
            await user.save({transaction});
        }
    }
});

Transaction.addHook('afterDestroy', async (expense, options) => {
    const transaction = options.transaction;
    const user = await userDetails.findByPk(expense.userID, {transaction});
    if (user) {
        user.totalExpense = parseFloat(user.totalExpense) - parseFloat(expense.amount);
        await user.save({transaction});
    }
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
                    where: { 
                        userID: user.id,
                        paymentStatus: 'success'
                    },
                    order: [['createdAt', 'DESC']],
                });

                const premiumUser = !!premiumOrder;
                res.status(200).json({
                    success: true,
                    token,
                    premiumUser
                });
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
        const registeredUser = await userDetails.findOne({
            where: {
                email: body.email
            }
        });
        if (!registeredUser) {
            const salt = bcryptjs.genSaltSync(10);
            const encryptedPassword = bcryptjs.hashSync(body.password, salt);

            const newUser = await userDetails.create({
                userName: body.userName,
                email: body.email,
                password: encryptedPassword,
            });
            res.status(200).json({
                success: true,
                newUser
            });
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

        await Transaction.create({
            userID: decoded.userID,
            date: body.date,
            description: body.description,
            category: body.category,
            transactionType: body.transactionType,
            amount: body.amount,
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
        
        const expense = await Transaction.findOne({
            where: {
                id: req.params.id,
                userID: decoded.userID
            }
        });
        if (!expense) return res.status(404).send({ success: false, message: 'Expense not found' });

        await Transaction.destroy({
            where: {
                id: req.params.id
            }
        });
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

        const page = parseInt(req.query.page || 1);
        const limit = parseInt(req.query.limit || 2);
        const offset = (page - 1) * limit;

        const {count, rows: updatedExpense} = await Transaction.findAndCountAll({
            where: {
                userID: decoded.userID,
                transactionType: 'expense'
            },
            limit,
            offset,
            order: [['date', 'DESC']]
        });
        const totalPage = Math.ceil(count/limit);
        res.status(200).json({
            success: true,
            updatedExpense,
            currentPage: page,
            totalPage
        });
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
        res.status(200).json({
            success: true,
            clientToken: createToken.clientToken,
            paymentDetails
        });
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
            });
            return res.status(200).json({
                success: true,
                transaction: result.transaction
            });
        } else {
            await orders.create({
                userID: decoded.userID,
                orderID: result.transaction.id,
                amount: amount,
                paymentStatus: 'failure'
            });
            return res.status(400).json({
                success: false,
                transaction: result.transaction
            });
        }
    } catch (err) {
        transactionError(err);
    }
});

const transactionError = (error) => {
    const filePath = path.join(__dirname, 'transaction-error.txt');
    const errorMessage = `[${new Date().toISOString()}] Error: ${error.message}\nStack Trace: ${error.stack}\n\n`;
    fs.appendFile(filePath, errorMessage, (err) => {
        if (err) {
            console.log('Failed to write Transaction Error to the file:', err);
        }
    });
}

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
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.get('/premiumFeature', async (req, res) => {
    try {
        const leaderboard = await userDetails.findAll({
            attributes: ['userName', 'totalExpense'],
            order: [['totalExpense', 'DESC']]
        });

        res.json({
            success: true,
            sortedExpense: leaderboard.map(user => ({
                userName: user.userName,
                total: parseFloat(user.totalExpense),
            }))
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Data not taken' });
    }
});

app.post('/recoverPassword', async (req, res) => {
    try {
        const {recoveryDetail} = req.body;

        const user = await userDetails.findOne({
            where: {email: recoveryDetail}
        });
        if (!user) return res.json({message: 'User not found'});

        const resetRequest = await forgotPassword.create({
            UUID: uuidv4(),
            userID: user.id
        });

        const resetLink = `http://localhost:3000/resetPassword/${resetRequest.UUID}`;
        const sendLink = {
            to: [{ email: recoveryDetail }],
            sender: { email: process.env.EMAIL, name: 'SpendSmart' },
            subject: 'Password Recovery Link',
            htmlContent: `
                <p>Hi,</p>
                <p>We received a request to reset your password. Click the link below to set a new password:</p>
                <a href="${resetLink}">Reset Password</a>
                <p>If you did not request this, please ignore this email.</p>
                <p>Thank you,<br>Your App Team</p>
            `,
        };
        await apiInstance.sendTransacEmail(sendLink);
        const message = 'Recovery Email send suceessfully'
        passwordMessage(message);
        res.json({success: 'true', message});
    } catch (err) {
        const message = 'Recovery Email not send successfully'
        passwordMessage(message);
        res.json({success: false, message});
    }
});

const passwordMessage = (message) => {
    const filePath = path.join(__dirname, 'password-message.txt');
    const passwordMessage = `[${new Date().toISOString()}] ${message}`;
    fs.appendFile(filePath, passwordMessage, (err) => {
        console.log('Failed to write file', err);
    });
}

app.get('/resetPassword/:UUID', async (req, res) => {
    try {
        const {UUID} = req.params;
        const resetRequest = await forgotPassword.findOne({
            where: {UUID, active: true}
        });

        if (!resetRequest) {
            return res.status(400).json({message: 'Invalid or expired reset link'});
        }
        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Reset Password</title>
            </head>
            <body>
                <h1>Reset Your Password</h1>
                <form id="resetPassword" method="POST" action="/updatePassword">
                    <input type="password" id="newPassword" name="newPassword" placeholder="New Password" required>
                    <input type="hidden" id="UUID" name="UUID" value="${UUID}">
                    <button type="submit">Submit</button>
                </form>
            </body>
            </html>
        `);
        } catch (err) {
        res.status(500).json({success: false, message: 'Failed to validate reset link'});
    }
});

app.post('/updatePassword', async (req, res) => {
    try {
        const {UUID, newPassword} = req.body;
        if (!UUID || !newPassword) {
            return res.status(400).json({ success: false, message: "UUID and newPassword are required" });
        }
        
        const resetRequest = await forgotPassword.findOne({
            where: {
                UUID,
                active: true
            }
        });
        if (!resetRequest) {
            return res.json({success: false, message: "Invalid or Expired Reset Link"});
        }

        const user = await userDetails.findOne({
            where: {
                id: resetRequest.userID
            }
        });
        if (!user) {
            return res.json({success: false, message: "User not found"});
        }

        const encryptedPassword = await bcryptjs.hash(newPassword, 10);
        user.password = encryptedPassword;
        await user.save();

        resetRequest.active = false;
        await resetRequest.save();
        res.json({success: true, message: "Password updated successfully"});
    } catch (err) {
        res.json({success: false, message: "Failed to update password"});
    }
});

app.get('/download', async (req, res) => {
    const token = req.headers['authorization'];
    if (!token) return res.json({message: 'Token not send'});

    try {
        const tokenParts = token.split(' ');
        const decoded = jwt.verify(tokenParts[1], 'secretKey');
        const userID = decoded.userID;

        const data = await Transaction.findAll({where: {userID: userID}});
        if (!data) return res.status(404).json({ message: 'Transaction data not found' });
        const formattedData = data.map(transaction => transaction.toJSON());
        const bucketName = `user-transaction-data-${userID}-${Date.now()}`;
        await checkBucket(bucketName);

        const fileName = `User Transaction-${userID}-${Date.now()}.json`;
        const fileUrl = await s3Upload(bucketName, fileName, formattedData);
        await Link.create({
            userID: userID,
            link: fileUrl
        });
        res.status(200).json({success: true, fileUrl});
    } catch (err) {
        res.json({success: false, message: 'Error in transaction file download'});
    }
});

app.get('/dailyExpense', async (req, res) => {
    const token = req.headers['authorization'];
    if (!token) return res.json({message: 'Token not provided'});

    try {
        const tokenPart = token.split(' ');
        const decoded = jwt.verify(tokenPart[1], 'secretKey');
        const userID = decoded.userID;

        const dayStart = moment().startOf('day').format('YYYY-MM-DD HH:mm:ss');
        const dayEnd = moment().endOf('day').format('YYYY-MM-DD HH:mm:ss');
        const dailyIncome = await Transaction.findAll({
            where: {
                userID: userID,
                transactionType: 'income',
                date: {
                    [Op.gte]: dayStart,
                    [Op.lt]: dayEnd
                }
            }
        });
        const dailyExpense = await Transaction.findAll({
            where: {
                userID: userID,
                transactionType: 'expense',
                date: {
                    [Op.gte]: dayStart,
                    [Op.lt]: dayEnd
                }
            }
        });
        res.status(200).json({success: true, dailyIncome, dailyExpense});
    } catch (err) {
        res.status(400).json({success: false, message: 'Daily Expense not collected'});
    }
});

app.get('/weeklyExpense', async (req, res) => {
    const token = req.headers['authorization'];
    if (!token) return res.json({message: 'Token not provided'});

    try {
        const tokenPart = token.split(' ');
        const decoded = jwt.verify(tokenPart[1], 'secretKey');
        const userID = decoded.userID;

        const weekStart = moment().startOf('week').startOf('day').format('YYYY-MM-DD HH:mm:ss');
        const weekEnd = moment().endOf('week').endOf('week').format('YYYY-MM-DD HH:mm:ss');
        const weeklyIncome = await Transaction.findAll({
            where: {
                userID: userID,
                transactionType: 'income',
                date: {
                    [Op.gte]: weekStart,
                    [Op.lt]: weekEnd
                }
            }
        });
        const weeklyExpense = await Transaction.findAll({
            where: {
                userID: decoded.userID,
                transactionType: 'expense',
                date: {
                    [Op.gte]: weekStart,
                    [Op.lt]: weekEnd
                }
            }
        });
        res.status(200).json({success: true, weeklyIncome, weeklyExpense});
    } catch (err) {
        res.status(400).json({success: false, message: 'Weekly Transaction not collected'});
    }
});

app.get('/monthlyExpense', async (req, res) => {
    const token = req.headers['authorization'];
    if (!token) return res.json({message: 'Token not send'});

    try {
        const tokenParts = token.split(' ');
        const decoded = jwt.verify(tokenParts[1], 'secretKey');
        const userID = decoded.userID;
        
        const monthStart = moment().startOf('month').startOf('day').format('YYYY-MM-DD HH:mm:ss');
        const monthEnd = moment().endOf('month').endOf('month').format('YYYY-MM-DD HH:mm:ss');
        const monthlyIncome = await Transaction.findAll({
            where: {
                userID: userID,
                transactionType: 'income',
                date: {
                    [Op.gte]: monthStart,
                    [Op.lt]: monthEnd
                }
            }
        });

        const monthlyExpense = await Transaction.findAll({
            where: {
                userID: userID,
                transactionType: 'expense',
                date: {
                    [Op.gte]: monthStart,
                    [Op.lt]: monthEnd
                }
            }
        });
        res.status(200).json({success: true, monthlyIncome, monthlyExpense});
    } catch (err) {
        res.status(400).json({success: false, message: 'Monthly chart not collected'});
    }
    
});

app.get('/incomeDetails', async (req, res) => {
    const token = req.headers['authorization'];
    if (!token) return res.json({message: 'No token provided'});

    try {
        const tokenParts = token.split(' ');
        const decoded = jwt.verify(tokenParts[1], 'secretKey');
        const userID = decoded.userID;

        const incomeDetails = await Transaction.findAll({
            where: {
                userID: userID,
                transactionType: 'income'
            }
        });
        res.status(200).json({
            success: true,
            incomeDetails
        });
    } catch (err) {
        res.status(400).json({
            success: false,
            message: 'Income details not collected'
        });
    }
});

app.get('/previousDownload', async (req, res) => {
    const token = req.headers['authorization'];
    if (!token) return res.json({
        message: 'No token provided'
    });

    try {
        const tokenParts = token.split(' ');
        const decoded = jwt.verify(tokenParts[1], 'secretKey');
        const userID = decoded.userID;

        const data = await Link.findAll({
            where: {
                userID: userID
            }
        });

        const previousList = data.map(previousLink => ({
            date: previousLink.createdAt,
            link: previousLink.link
            }));
        res.status(200).json({
            success: true,
            previousList
        });
    } catch (err) {
        res.status(400).json({
            success: false,
            message: 'Previous download link not collected'
        });
    }
});

const PORT = process.env.DB_PORT;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
