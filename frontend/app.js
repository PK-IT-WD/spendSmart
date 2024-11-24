document.addEventListener('DOMContentLoaded', async () => {
    
    const message = document.getElementById('message');
    const expenseForm = document.getElementById('expenseForm');
    const allExpense = document.getElementById('allExpense');
    const signup = document.getElementById('signup');
    const login = document.getElementById('login');
    const submitPayment = document.getElementById('submitPayment');
    const paymentAmount = document.getElementById('paymentAmount');
    const premiumUser = document.getElementById('premiumUser');
    const leaderboard = document.getElementById('leaderboard');

    if (expenseForm || allExpense) {

        if (typeof displayAllExpense === 'function') {

            await displayAllExpense();

        }

        if (typeof checkStatus === 'function') {

            await checkStatus();

        }

    }

    if (signup) {

        signup.addEventListener('submit', async (event) => {

            event.preventDefault();

            try {

                const userDetails = {
                    userName : document.getElementById('userName').value,
                    email: document.getElementById('email').value,
                    password: document.getElementById('password').value
                }
        
                const response = await fetch('/signup', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(userDetails)
                });
        
                const data = await response.json();
    
                if (data.success) {
    
                    message.innerHTML = `<p>User registered successfully</p>`;
    
                } else {
    
                    message.innerHTML = `<p>${data.message}</p>`;
    
                }
    
                signup.reset();

            } catch (err) {

                console.error('Signup error', err);
                message.innerHTML = `<p>Failed to register User</p>`;

            }
        
        });

    }
    
    if (login) {

        login.addEventListener('submit', async (event) => {

            event.preventDefault();

            try {

                const userDetails = {
                    email: document.getElementById('email').value,
                    password: document.getElementById('password').value
                }
            
                const response = await fetch('/login', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(userDetails)
                });
        
                const data = await response.json();
    
                if (data.success) {
    
                    localStorage.setItem('token', data.token);
                    window.location.href = '/expenses.html';
    
                } else {
    
                    message.innerHTML = `<p>${data.message}</p>`;
    
                }
    
                login.reset();

            } catch (err) {

                console.error('Login error', err);
                message.innerHTML = `<p>Login failed</p>`

            }
        
        });

    }
    
    if (expenseForm) {

        expenseForm.addEventListener('submit', async (event) => {

            event.preventDefault();

            try {

                const expenseDetails = {

                    category: document.getElementById('category').value,
                    description: document.getElementById('description').value,
                    amount: document.getElementById('amount').value
    
                }
    
                const token = localStorage.getItem('token');
    
                if (!token) {
    
                    message.innerHTML = `<p>Please login first</p>`;
                    return;
    
                }
    
                const response = await fetch('/addExpense', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(expenseDetails)
                });
    
                const data = await response.json();
    
                if (data.success) {
    
                    await displayAllExpense();
    
                } else {
    
                    console.log('Failed to add expense');
    
                }
    
                expenseForm.reset();

            } catch (err) {

                console.error('Add expense error', err);
                message.innerHTML = `<p>Failed to add expense</p>`

            }

        });

    }

    async function displayAllExpense() {

        const token = localStorage.getItem('token');

        if (!token) {

            message.innerHTML = `<p>Please login first</p>`;
            return;

        }

        try {

            const response = await fetch('/allExpense', 
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    }
            });

            const data = await response.json();

            if (data.success) {

                await displayExpense(data.updatedExpense);

            } else {

                console.log(data.message);

            }
        } catch (err) {

            console.error('Error fetching expenses', err);
            message.innerHTML = `<p>Failed to fetch expenses</p>`;
        
        }

    }

    async function displayExpense(expenses = []) {

        if (!allExpense) {

            console.error("Expense container element not found");
            return;

        }

        allExpense.innerHTML = "";

        if (expenses.length === 0) {

            allExpense.innerHTML = 'No expenses';
            return;

        }

        expenses.forEach((expense) => {

            const expenseList = document.createElement('div');
            expenseList.innerHTML = `
            <p>${expense.category}</p>
            <p>${expense.description}</p>
            <p>${expense.amount}</p>`;

            const deleteButton = document.createElement('button');
            deleteButton.textContent = 'Delete';
            deleteButton.onclick = async () => {
                await deleteExpense(expense.id);
            }
            expenseList.appendChild(deleteButton);
            allExpense.appendChild(expenseList);

        });

    }

    async function deleteExpense(id) {

        const token = localStorage.getItem('token');

        if (!token) {

            message.innerHTML = `<p>Please login first</p>`;
            return;

        }

        try {

            const response = await fetch(`/deleteExpense/${id}`,{
                method: 'DELETE',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });
    
            const data = await response.json();
    
            if (data.success) {
    
                await displayAllExpense();
    
            }

        } catch (err) {

            console.error('Delete expense error', err);

        }

    }

    async function checkStatus() {

        const token = localStorage.getItem('token');

        try {

            const response = await fetch('/premiumUser', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (data.success) {

                premiumUser.textContent = 'Premium User';

                const div = document.createElement('div');
                const leaderboardButton = document.createElement('button');
                leaderboardButton.textContent = 'Show Leaderboard';

                div.appendChild(leaderboardButton);
                premiumUser.appendChild(div);

                if (leaderboardButton) {
                    leaderboardButton.addEventListener('click', async () => {
                        
                        try {
                            const response = await fetch('/premiumFeature', {
                                method: 'GET'
                            });
                            
                            const data = await response.json();
                                if (data.success) {
                                    
                                    leaderboard.innerHTML = "";
                                    data.sortedExpense.forEach(expense => {
                                        const div = document.createElement('div');
                                        div.innerHTML = `User Name - ${expense.userName} Total Expense - ${expense.total}`
                                        leaderboard.appendChild(div);
                                    })
                                }

                        } catch (err) {
                            console.log(err);
                        }
                        
                    })
                }
                
    
            }

            else {

                premiumUser.textContent = 'Payment for Premium Membership';
                const premiumMembership = document.createElement('button');
                premiumMembership.id = 'premiumMembership';
                premiumMembership.textContent = 'Premium User';
                premiumUser.appendChild(premiumMembership);

                if (premiumMembership) {

                    premiumMembership.addEventListener('click', async () => {
            
                        const dropinContainer = document.getElementById('dropin-container');
                    
                        if (!dropinContainer) {
                            console.error("Drop-in container element not found in HTML.");
                            return;
                        }
            
                        if (dropinContainer.hasChildNodes()) {
                            console.warn("Drop-in container is not empty. Clearing previous content.");
                            dropinContainer.innerHTML = '';
                        }
            
                        try {
                            
                            const response = await fetch('/premiumMembership', {
                                method: 'GET',
                                headers: {'Content-Type': 'application/json'}
                            });
            
                            const {clientToken, paymentDetails} = await response.json();
            
                            paymentAmount.innerText = `Amount: ${paymentDetails.amount}`;
            
                            braintree.dropin.create({
            
                                authorization: clientToken,
                                container: '#dropin-container'
            
                            }, (err, instance) => {
                                if (err) {
                                    
                                    console.log(err);
                                    return;
            
                                }
            
                                submitPayment.style.display = 'block';
            
                                submitPayment.addEventListener('click', async () => {
                                    instance.requestPaymentMethod(async (err, payload) => {
                                        if (err) {
            
                                            console.log(err);
                                            alert("Payment Failure");
                                            window.location.reload();
                                            return;
            
                                        }
            
                                        const token = localStorage.getItem('token');

                                        try {

                                            const response = await fetch('/createTransaction', {
                                                method: 'POST',
                                                headers: {
                                                    'Content-Type': 'application/json',
                                                    'Authorization': `Bearer ${token}`
                                                },
                                                body: JSON.stringify({
                                                    nonce: payload.nonce,
                                                    amount: paymentDetails.amount
                                                })
                                            })
                
                                            const data = await response.json();
                
                                            if (data.success) {
                
                                                alert('Payment Successfull');
                                                window.location.reload();
                
                                            } else {
                
                                                alert('Payment Failure');
                                                window.location.reload();
                
                                            }

                                        } catch (err) {

                                            alert("Payment Failure");
                                            window.location.reload();

                                        }
            
                                        
            
                                    })
                                })
                            })
                
                        } catch (err) {
            
                            console.log('Client Token creation');
            
                        }
                        
                    });
                    
                }

            }

        } catch (err) {

            console.error('Error on checking premium menbership', err);

        }

    }

});