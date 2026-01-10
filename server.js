const express = require('express');
const app = express();
require('dotenv').config();

// If no key is found, this prevents crash but payments will fail
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const cors = require('cors');

// Serve the 'public' folder
// Note: On Vercel, this static serving is often handled by Vercel itself, 
// but we keep this for local testing compatibility.
app.use(express.static('public'));
app.use(express.json());
app.use(cors());

app.get('/', (req, res) => {
    res.send("SPBAA Payment Server is Running!");
});

app.post('/create-payment-intent', async (req, res) => {
    const { amount, paymentMethodType, isAutoPay, name, memberNum } = req.body;

    // Validate amount (must be integer cents)
    if (!amount || isNaN(amount) || amount < 50) {
        return res.status(400).send({ error: 'Invalid amount' });
    }

    try {
        let customerId = null;

        // Create a Customer if Auto-Pay is requested OR if it's ACH (Stripe recommends Customers for ACH)
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

        // Prepare the PaymentIntent options
        const paymentIntentOptions = {
            amount: amount, 
            currency: 'usd',
            // If user selected 'ach', we restrict to 'us_bank_account', otherwise 'card'
            payment_method_types: [paymentMethodType === 'ach' ? 'us_bank_account' : 'card'],
            metadata: {
                memberNumber: memberNum,
                autoPay: isAutoPay ? 'true' : 'false'
            }
        };

        // If we have a customer, attach them
        if (customerId) {
            paymentIntentOptions.customer = customerId;
        }

        // Setup for future usage (Auto-Pay)
        if (isAutoPay) {
            paymentIntentOptions.setup_future_usage = 'off_session';
        } else if (paymentMethodType === 'ach') {
            // ACH often defaults to creating a setup for convenience, but strictly 'on_session' is safer if no auto-pay
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

const PORT = process.env.PORT || 4242;

// Only run the server on a port if we are NOT in a Vercel environment
// (Vercel handles the port binding automatically)
if (require.main === module) {
    app.listen(PORT, () => console.log(`Node server listening on port ${PORT}!`));
}

// Export the app for Vercel to load as a serverless function
module.exports = app;
