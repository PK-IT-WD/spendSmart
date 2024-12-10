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
    const forgotPassword = document.getElementById('forgotPassword');
    const resetPassword = document.getElementById('resetPassword');
    const dailyChart = document.getElementById('dailyChart');
    const weeklyChart = document.getElementById('weeklyChart');
    const monthlyChart = document.getElementById('monthlyChart');
    const incomeDetails = document.getElementById('incomeDetails');
    const transactionDownload = document.getElementById('transactionDownload');
    const previousDownload = document.getElementById('previousDownload');
    let currentPage = 1;

    if (expenseForm || allExpense) {
        if (typeof displayAllExpense === 'function') {
            await limitDropdown();
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
                message.innerHTML = `<p>Login failed</p>`
            }
        });

        if (forgotPassword) {
            forgotPassword.addEventListener('click', () => {
                const div = document.createElement('div');
                div.style.marginTop = '20px';
    
                const form = document.createElement('form');
                form.id = 'recoverPassword';
    
                const input = document.createElement('input');
                input.type = 'email';
                input.id = 'userData';
                input.name = 'email';
                input.placeholder = 'Enter Your Email address';
                input.required = 'true';
    
                const button = document.createElement('button');
                button.type = 'submit';
                button.textContent = 'Submit';
                
                form.appendChild(input);
                form.appendChild(button);
                div.appendChild(form);

                document.body.appendChild(div);

                const recoverPassword = document.getElementById('recoverPassword');
                if (recoverPassword) {
                    recoverPassword.addEventListener('submit', async (event) => {
                        event.preventDefault();
                        const recoveryDetail = document.getElementById('userData').value;
    
                        const response = await fetch('/recoverPassword', {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({recoveryDetail})
                        });
    
                        const data = await response.json();
                        if (data.success) {
                            console.log(data.message);
                        }
                        else {
                            console.log(data.message)
                        }
                        document.body.removeChild(div);
                    })
                }
            })
        }
    }
    
    if (expenseForm) {
        expenseForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            try {
                const expenseDetails = {
                    date: document.getElementById('date').value,
                    description: document.getElementById('description').value,
                    category: document.getElementById('category').value,
                    transactionType: document.getElementById('transactionType').value,
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
                message.innerHTML = `<p>Failed to add expense</p>`
            }
        });
    }

    function setLimit(limit) {
        localStorage.setItem('limit', limit);
        displayAllExpense();
    }

    function limitDropdown() {
        const select = document.createElement('select');
        const options = [2, 4, 6, 8, 10];
    
        options.forEach((value) => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = value;
    
            if ((value == localStorage.getItem('limit')) || (value === 2 && !localStorage.getItem('limit'))) {
                option.selected = true;
            }
    
            select.appendChild(option);
        });
    
        select.addEventListener('change', (event) => {
            setLimit(event.target.value);
        });

        const div = document.createElement('div');
        const p = document.createElement('p');
        p.textContent = 'Select Limit';
        div.appendChild(p);
        div.appendChild(select);
        document.body.appendChild(div);
    }

    async function displayAllExpense(page = 1) {
        const token = localStorage.getItem('token');
        if (!token) return message.innerHTML = `<p>Please login first</p>`;

        const limit = localStorage.getItem('limit') || 2
        try {
            const response = await fetch(`/allExpense?page=${page}&limit=${limit}`,
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    }
            });
            const data = await response.json();
            if (data.success) {
                currentPage = page;
                await displayExpense(data.updatedExpense, data.totalPage);
            } else {
                console.log(data.message);
            }
        } catch (err) {
            message.innerHTML = `<p>Failed to fetch expenses</p>`;
        }
    }

    async function displayExpense(expenses = [], totalPage = 1) {
        if (!allExpense) return console.error("Expense container element not found");

        allExpense.innerHTML = "";
        
        const expenseDiv = document.createElement('div');
        const h2 = document.createElement('h2');
        h2.textContent = 'Expense Details';
        expenseDiv.appendChild(h2);
        allExpense.appendChild(expenseDiv);

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

        const paginationDiv = document.createElement('div');
        paginationDiv.style.display = 'flex';
        paginationDiv.style.justifyContent = 'space-between';

        const previousButton = document.createElement('button');
        previousButton.textContent = 'Previous';
        previousButton.disabled = currentPage === 1;
        previousButton.addEventListener('click', async () => {
            if (currentPage > 1) {
                await displayAllExpense(currentPage - 1);
            }
        });
        paginationDiv.appendChild(previousButton);

        const pageInfo = document.createElement('span');
        pageInfo.textContent = `Page ${currentPage} / ${totalPage}`;
        paginationDiv.appendChild(pageInfo);

        const nextButton = document.createElement('button');
        nextButton.textContent = 'Next';
        nextButton.disabled = currentPage === totalPage;
        nextButton.addEventListener('click', async () => {
            if (currentPage < totalPage) {
                await displayAllExpense(currentPage + 1);
            }
        });
        paginationDiv.appendChild(nextButton);
        allExpense.appendChild(paginationDiv);
    }

    async function deleteExpense(id) {
        const token = localStorage.getItem('token');
        if (!token) return message.innerHTML = `<p>Please login first</p>`;
        
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

                const incomeDiv = document.createElement('div');
                const incomeButton = document.createElement('button');
                incomeButton.textContent = 'Income';
                incomeDiv.appendChild(incomeButton);
                premiumUser.appendChild(incomeDiv);

                const dailyDiv = document.createElement('div');
                const dailyButton = document.createElement('button');
                dailyButton.textContent = 'Daily Chart';
                dailyDiv.appendChild(dailyButton);
                premiumUser.appendChild(dailyDiv);

                const weeklyDiv = document.createElement('div');
                const weeklyButton = document.createElement('button');
                weeklyButton.textContent = 'Weekly Chart';
                weeklyDiv.appendChild(weeklyButton);
                premiumUser.appendChild(weeklyDiv);

                const monthlyDiv = document.createElement('div');
                const monthlyButton = document.createElement('button');
                monthlyButton.textContent = 'Monthly Chart';
                monthlyDiv.appendChild(monthlyButton);
                premiumUser.appendChild(monthlyDiv);

                if (incomeButton) {
                    incomeButton.addEventListener('click', async () => {
                        try {
                            const response = await fetch('/incomeDetails', {
                                method: 'GET',
                                headers: {
                                    'Authorization': `Bearer ${token}`
                                }
                            });

                            const data = await response.json();
                            try {
                                if (data.success) {
                                    incomeDetails.innerHTML = '';
                                    const div = document.createElement('div');
                                    const h2 = document.createElement('h2');
                                    h2.textContent = 'Income Details';
                                    div.appendChild(h2);
                                    incomeDetails.appendChild(div);
                                    
                                    if (data.incomeDetails.length === 0) {
                                        const div = document.createElement('div');
                                        const p = document.createElement('p');
                                        p.textContent = 'There is no income present';
                                        div.appendChild(p);
                                        incomeDetails.appendChild(div);
                                    } else {
                                        const div = document.createElement('div');
                                        data.incomeDetails.forEach(income => {
                                            const p = document.createElement('p');
                                            p.textContent = `Income-${income.amount}-Description-${income.description}-Category-${income.category}`;
                                            div.appendChild(p);
                                        });
                                        incomeDetails.appendChild(div);
                                    }
                                } else {
                                    console.log('Income details are not collected');
                                }
                            } catch (err) {
                                console.log(err);
                            }
                        } catch (err) {
                            console.log(err);
                        }
                    });
                } else {
                    console.log('Error on Income button');
                }
                
                if (dailyButton) {
                    dailyButton.addEventListener('click', async() => {
                        try {
                            const response = await fetch('/dailyExpense', {
                                method: 'GET',
                                headers: {
                                    'Authorization': `Bearer ${token}` 
                                }
                            });

                            const data = await response.json();
                            try {
                                if (data.success) {
                                    dailyChart.innerHTML = '';
                                    const div = document.createElement('div');
                                    const h2 = document.createElement('h2');
                                    h2.textContent = 'Daily Transaction Chart';
                                    div.appendChild(h2);
                                    dailyChart.appendChild(div);
        
                                    if (data.dailyIncome.length === 0) {
                                        const div = document.createElement('div');
                                        const p = document.createElement('p');
                                        p.textContent = 'There is no income present';
                                        div.appendChild(p);
                                        dailyChart.appendChild(div);
                                    } else {
                                        const div = document.createElement('div');
                                        data.dailyIncome.forEach(income => {
                                            const p = document.createElement('p');
                                            p.textContent = `Income-${income.amount}-Description-${income.description}-Category${income.category}`;
                                            div.appendChild(p);
                                        });
                                        dailyChart.appendChild(div);
                                    }
                                } else {
                                    console.log('Daily chart details not collected');
                                    console.log(data.message);
                                }

                                if (data.dailyExpense.length === 0) {
                                    const div = document.createElement('div');
                                    const p = document.createElement('p');
                                    p.textContent = 'There is no expense present';
                                    div.appendChild(p);
                                    dailyChart.appendChild(div);
                                } else {
                                    const div = document.createElement('div');
                                    data.dailyExpense.forEach(expense => {
                                        const p = document.createElement('p');
                                        p.textContent = `Expense-${expense.amount}-Description-${expense.description}-Category${expense.category}`;
                                        div.appendChild(p);
                                    });
                                    dailyChart.appendChild(div);
                                }
                            } catch (err) {
                                console.log(err);
                            }
                        } catch (err) {
                            console.log(err);
                        }
                    });
                } else {
                    console.log('Error on Daily Chart button');
                }
                
                if (weeklyButton) {
                    weeklyButton.addEventListener('click', async () => {
                        try {
                            const response = await fetch('/weeklyExpense', {
                                method: 'GET',
                                headers: {
                                    'Authorization': `Bearer ${token}`
                                }
                            });

                            const data = await response.json();
                            try {
                                if (data.success) {
                                    weeklyChart.innerHTML = '';
                                    const div = document.createElement('div');
                                    const h2 = document.createElement('h2');
                                    h2.textContent = 'Week chart Details';
                                    div.appendChild(h2);
                                    weeklyChart.appendChild(div);

                                    if (data.weeklyIncome.length === 0) {
                                        const div = document.createElement('div');
                                        const p = document.createElement('p');
                                        p.textContent = 'No income details are present';
                                        div.appendChild(p);
                                        weeklyChart.appendChild(div);
                                    } else {
                                        const div = document.createElement('div');
                                        data.weeklyIncome.forEach(income => {
                                            const p = document.createElement('p');
                                            p.textContent = `Income-${income.amount}-Description-${income.description}-Category-${income.category}`;
                                            div.appendChild(p);
                                        });
                                        weeklyChart.appendChild(div);
                                    }

                                    if (data.weeklyExpense.length === 0) {
                                        const div = document.createElement('div');
                                        const p = document.createElement('p');
                                        p.textContent = 'No expense present';
                                        div.appendChild(p);
                                        weeklyChart.appendChild(div);
                                    } else {
                                        const div = document.createElement('div');
                                        data.weeklyExpense.forEach(expense => {
                                            const p = document.createElement('p');
                                            p.textContent = `Expense-${expense.amount}-Description-${expense.description}-Category-${expense.category}`;
                                            div.appendChild(p);
                                        });
                                        weeklyChart.appendChild(div);
                                    }
                                } else {
                                    console.log('Weekly chart details not collected');
                                }
                            } catch (err) {
                                console.log(err);
                            }
                        } catch (err) {
                            console.log(err);
                        }
                    });
                } else {
                    console.log('Error on Weekly Chart button');
                }
                
                if (monthlyButton) {
                    monthlyButton.addEventListener('click', async () => {
                        try {
                            const response = await fetch('/monthlyExpense', {
                                method: 'GET',
                                headers: {
                                    'Authorization': `Bearer ${token}`
                                }
                            });

                            const data = await response.json();
                            try {
                                if (data.success) {
                                    monthlyChart.innerHTML = '';
                                    const div = document.createElement('div');
                                    const h2 = document.createElement('h2');
                                    h2.textContent = 'Monthly Transaction';
                                    div.appendChild(h2);
                                    monthlyChart.appendChild(div);
        
                                    if (data.monthlyIncome.length === 0) {
                                        const div = document.createElement('div');
                                        const p = document.createElement('p');
                                        p.textContent = 'There is no income';
                                        div.appendChild(p);
                                        monthlyChart.appendChild(div);
                                    } else {
                                        const div = document.createElement('div');
                                        data.monthlyIncome.forEach(income => {
                                            const p = document.createElement('p');
                                            p.textContent = `Income-${income.amount}-Description-${income.description}-Category-${income.category}`;
                                            div.appendChild(p);
                                        });
                                        monthlyChart.appendChild(div);
                                    }
                                    
                                    if (data.monthlyExpense.length === 0) {
                                        const div = document.createElement('div');
                                        const p = document.createElement('p');
                                        p.textContent = 'There is no expense';
                                        div.appendChild(p);
                                        monthlyChart.appendChild(div);
                                    } else {
                                        const div = document.createElement('div');
                                        data.monthlyExpense.forEach(expense => {
                                            const p = document.createElement('p');
                                            p.textContent = `Expense-${expense.amount}-Description-${expense.description}-Category-${expense.category}`;
                                            div.appendChild(p);
                                        });
                                        monthlyChart.appendChild(div);
                                    }
                                } else {
                                    console.log('Monthly expense details not collected');
                                }
                            } catch (err) {
                                console.log(err);
                            }
                        } catch (err) {
                            console.log(err);
                        }
                    });
                } else {
                    console.log('Error on Monthly Chart button');
                }

                const downloadDiv = document.createElement('div');
                const downloadButton = document.createElement('button');
                downloadButton.textContent = 'Download Expense';
                downloadDiv.appendChild(downloadButton);
                premiumUser.appendChild(downloadDiv);

                if (downloadButton) {
                    downloadButton.addEventListener('click', async () => {
                        try {
                            const response = await fetch('/download', {
                                method: 'GET',
                                headers: {
                                    'Authorization': `Bearer ${token}`
                                }
                            });

                            const data = await response.json();
                            if (data.success) {
                                transactionDownload.innerHTML = '';
                                const div = document.createElement('div');
                                const h2 = document.createElement('h2');
                                const p = document.createElement('p');
                                h2.textContent = 'Download Link';
                                div.appendChild(h2);
                                p.textContent = `${data.fileUrl}`;
                                div.appendChild(p);
                                transactionDownload.appendChild(div);
                            } else {
                                console.log('Download details not collected');
                            }
                        } catch (err) {
                            console.log(err);
                        }
                    });
                } else {
                    console.log('Error on Download button');
                }

                const previousDiv = document.createElement('div');
                const previousButton = document.createElement('button');
                previousButton.textContent = 'Previous Download';
                previousDiv.appendChild(previousButton);
                premiumUser.appendChild(previousButton);

                if (previousButton) {
                    previousButton.addEventListener('click', async () => {
                        try {
                            const response = await fetch('previousDownload', {
                                method: 'GET',
                                headers: {
                                    'Authorization': `Bearer ${token}`
                                }
                            });

                            const data = await response.json();
                            if (data.success) {
                                previousDownload.innerHTML = '';
                                const div = document.createElement('div');
                                const h2 = document.createElement('h2');
                                h2.textContent = 'Previous Download link';
                                div.appendChild(h2);
                                previousDownload.appendChild(div);
                                try {
                                    if (data.previousList.length === 0) {
                                        const div = document.createElement('div');
                                        const p = document.createElement('p');
                                        p.textContent = 'No previous link is provided';
                                        div.appendChild(p);
                                        previousDownload.appendChild(div);
                                    } else {
                                        const div = document.createElement('div');
                                        data.previousList.forEach(link => {
                                            const p = document.createElement('p');
                                            p.textContent = `Date-${link.date}-Download Link-${link.link}`;
                                            div.appendChild(p);
                                        });
                                        previousDownload.appendChild(div);
                                    }
                                } catch {
                                    console.log('Previous link are not collected');
                                }
                            } else {
                                console.log(data.message);
                            }
                        } catch (err) {
                            console.log(err);
                        }
                    });
                } else {
                    console.log('Error on previous button');
                }

                const leaderboardDiv = document.createElement('div');
                const leaderboardButton = document.createElement('button');
                leaderboardButton.textContent = 'Show Leaderboard';
                leaderboardDiv.appendChild(leaderboardButton);
                premiumUser.appendChild(leaderboardDiv);

                if (leaderboardDiv) {
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
                                    });
                                }
                            } catch (err) {
                            console.log(err);
                        }
                    });
                }
            } else {
                premiumUser.textContent = 'Payment for Premium Membership';
                const premiumMembership = document.createElement('button');
                premiumMembership.id = 'premiumMembership';
                premiumMembership.textContent = 'Premium User';
                premiumUser.appendChild(premiumMembership);

                if (premiumMembership) {
                    premiumMembership.addEventListener('click', async () => {
                        const dropinContainer = document.getElementById('dropin-container');
                        if (!dropinContainer) return console.error("Drop-in container element not found in HTML.");
                        
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
                                if (err) return console.log(err);
                                
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
                                            });
                
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
                                    });
                                });
                            });
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
    
    if (resetPassword) {
        resetPassword.addEventListener('submit', async (event) => {
            event.preventDefault();

            try {
                const newPassword = document.getElementById('newPassword').value.trim();
                const UUID = document.getElementById('UUID').value.trim();
                if (!newPassword || !UUID) return alert('Both fields are required!');

                const response = await fetch('/updatePassword', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ UUID, newPassword }),
                });

                const data = await response.json();
                if (data.success) {
                    alert('Password updated successfully!');
                    window.location.href = '/login';
                } else {
                    alert('Error: ' + data.message);
                }
            } catch (err) {
                console.error('Error:', err);
                alert('An unexpected error occurred. Please try again later.');
            }
        });
    }
});