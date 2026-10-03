/**
 * Razorpay Checkout SDK Script Loader and Modal Launcher
 */

export const loadRazorpayScript = () => {
    return new Promise((resolve) => {
        if (window.Razorpay) {
            resolve(true);
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload = () => {
            resolve(true);
        };
        script.onerror = () => {
            console.error('Failed to load Razorpay Checkout SDK');
            resolve(false);
        };
        document.body.appendChild(script);
    });
};

export const initiateRazorpayCheckout = async ({
    orderId,
    amount,
    currency = 'INR',
    keyId,
    planName,
    companyName,
    customerName,
    customerEmail,
    customerPhone,
    onSuccess,
    onFailure
}) => {
    const isLoaded = await loadRazorpayScript();
    if (!isLoaded) {
        if (onFailure) onFailure(new Error('Razorpay SDK failed to load. Please check your internet connection.'));
        return;
    }

    const options = {
        key: keyId || import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_live_T2CGGz8NLUuopj',
        amount: amount, // in paise
        currency: currency,
        name: 'HRM Software Pro',
        description: `${planName || 'Subscription'} Activation & Renewal`,
        order_id: orderId,
        handler: async (response) => {
            // response contains: razorpay_payment_id, razorpay_order_id, razorpay_signature
            if (onSuccess) {
                try {
                    await onSuccess(response);
                } catch (err) {
                    console.error('Error in payment success handler:', err);
                    if (onFailure) onFailure(err);
                }
            }
        },
        prefill: {
            name: customerName || '',
            email: customerEmail || '',
            contact: customerPhone || ''
        },
        notes: {
            company_name: companyName || '',
            plan_name: planName || ''
        },
        theme: {
            color: '#4F46E5' // Nexus primary indigo theme
        },
        modal: {
            ondismiss: () => {
                if (onFailure) {
                    onFailure(new Error('Payment window closed by user. No charges were made.'));
                }
            }
        }
    };

    const rzp = new window.Razorpay(options);
    rzp.on('payment.failed', function (response) {
        console.error('Razorpay Payment Failed:', response.error);
        if (onFailure) {
            onFailure(new Error(response.error.description || 'Payment transaction failed.'));
        }
    });
    rzp.open();
};
