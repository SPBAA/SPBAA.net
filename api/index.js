const express = require('express');
const app = express();
require('dotenv').config();

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const cors = require('cors');

app.use(express.json());
app.use(cors());

// Health check route
app.get('/api/status', (req, res) => {
    res.send("Server is Active");
});

app.post('/api/create-payment-intent', async (req, res) => {
    const { amount, paymentMethodType, isAutoPay, name, memberNum } = req.body;

    if (!amount || isNaN(amount) || amount < 50) {
        return res.status(400).send({ error: 'Invalid amount' });
    }

    try {
        let customerId = null;

        if (isAutoPay || paymentMethodType === 'ach') {
            const customer = await stripe.customers.create({
                name: name,
                metadata: {
                    memberNumber: memberNum,
                    autoPayRequested: isAutoPay ? 'true' : 'false'
                }
            });
            customerId = customer.id;
        }

        const paymentIntentOptions = {
            amount: amount, 
            currency: 'usd',
            payment_method_types: [paymentMethodType === 'ach' ? 'us_bank_account' : 'card'],
            metadata: {
                memberNumber: memberNum,
                autoPay: isAutoPay ? 'true' : 'false'
            }
        };

        if (customerId) {
            paymentIntentOptions.customer = customerId;
        }

        if (isAutoPay) {
            paymentIntentOptions.setup_future_usage = 'off_session';
        } else if (paymentMethodType === 'ach') {
            paymentIntentOptions.setup_future_usage = 'on_session'; 
        }

        const paymentIntent = await stripe.paymentIntents.create(paymentIntentOptions);

        res.send({
            clientSecret: paymentIntent.client_secret,
        });
    } catch (e) {
        console.error("Stripe Error:", e.message);
        res.status(400).send({ error: e.message });
    }
});

module.exports = app;
