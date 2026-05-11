"use client";
import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { createSubscriptionOrder, verifyAndActiveSubscription, getDb } from '@/app/actions';
import Script from 'next/script';
import StructuredData from '@/components/SEO/StructuredData';

export default function PricingContent() {
  const { isAuthenticated } = useAuth();
  const [loadingPlan, setLoadingPlan] = React.useState<string | null>(null);
  const [currentSubscription, setCurrentSubscription] = React.useState<any>(null);

  React.useEffect(() => {
    if (isAuthenticated) {
      getDb().then(db => {
        setCurrentSubscription(db.settings?.subscription || null);
      });
    }
  }, [isAuthenticated]);

  const handleSubscribe = async (planName: string, amount: string) => {
    if (!isAuthenticated) {
      window.location.href = '/auth/login';
      return;
    }

    setLoadingPlan(planName);
    try {
      const numAmount = parseInt(amount.replace(',', ''));
      const result = await createSubscriptionOrder(planName, numAmount);

      if (!result.success || !result.order) {
        alert(result.error || 'Failed to create order');
        return;
      }

      const options = {
        key: result.key_id,
        amount: result.order.amount,
        currency: result.order.currency,
        name: "Stitch Spectrum",
        description: `${planName} Subscription`,
        order_id: result.order.id,
        handler: async function (response: any) {
          const verifyResult = await verifyAndActiveSubscription({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            planName: planName
          });

          if (verifyResult.success) {
            alert('Subscription activated successfully!');
            window.location.reload();
          } else {
            alert('Payment verification failed.');
          }
        },
        prefill: {
          name: "",
          email: "",
        },
        theme: {
          color: "#fce003",
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error(err);
      alert('Failed to initiate payment.');
    } finally {
      setLoadingPlan(null);
    }
  };

  const plans = [
    {
      name: 'Monthly',
      price: '100',
      period: 'per month',
      description: 'Ideal for small studios starting their digital transition.',
      features: [
        'Complete Project Tracking',
        'Client Management CRM',
        'Team Performance Analytics',
        'Gmail Inbox Integration',
        'Standard Support'
      ],
      color: 'border-white/10',
      buttonClass: 'bg-surface-container text-white border border-white/10 hover:border-white/30'
    },
    {
      name: 'Yearly',
      price: '1,000',
      period: 'per year',
      description: 'Best value for established agencies with high volume.',
      features: [
        'Everything in Monthly',
        '2 Months Free (Save ₹200)',
        'Priority Technical Support',
        'Advanced Reporting',
        'Early Access to Features'
      ],
      popular: true,
      color: 'border-yellow-400',
      buttonClass: 'electric-gradient text-black font-black'
    }
  ];

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "CADONCE Subscription Plans",
    "description": "Subscription plans for CADONCE project management platform.",
    "offers": plans.map(plan => ({
      "@type": "Offer",
      "name": plan.name,
      "price": plan.price.replace(',', ''),
      "priceCurrency": "INR",
      "description": plan.description,
      "url": "https://cadonce.com/pricing"
    }))
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <StructuredData data={structuredData} />
      {/* Top Nav */}
      <nav className="p-6 flex justify-between items-center max-w-7xl mx-auto">
        <Link href="/" className="flex items-center gap-2">
           <div className="w-8 h-8 rounded-lg electric-gradient flex items-center justify-center">
             <span className="material-symbols-outlined text-black text-xl font-black">architecture</span>
           </div>
           <span className="font-headline font-black text-white tracking-tighter">CADONCE</span>
        </Link>
        {isAuthenticated ? (
          <Link href="/" className="text-xs font-black text-yellow-400 uppercase tracking-widest hover:underline">Go to Dashboard</Link>
        ) : (
          <Link href="/auth/login" className="text-xs font-black text-white uppercase tracking-widest hover:underline">Log In</Link>
        )}
      </nav>

      <div className="max-w-5xl mx-auto px-6 pt-12 text-center">
        <h1 className="text-4xl md:text-6xl font-headline font-black text-white tracking-tight mb-4">
          Simple, Transparent <br/> <span className="text-yellow-400">Precision Pricing</span>
        </h1>
        <p className="text-on-surface-variant text-sm md:text-lg max-w-2xl mx-auto mb-16 opacity-70">
          Empower your CAD organization with professional task management, client CRM, and integrated communications.
        </p>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {plans.map((plan) => (
            <div 
              key={plan.name}
              className={`relative bg-surface-container-low rounded-[2.5rem] p-10 border-2 ${plan.color} text-left flex flex-col shadow-2xl transition-transform hover:scale-[1.02]`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-yellow-400 text-black px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl">
                  Best Value
                </div>
              )}
              
              <div className="mb-8">
                <h3 className="text-sm font-black text-neutral-500 uppercase tracking-[0.2em] mb-4">{plan.name} Plan</h3>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-5xl font-headline font-black text-white">₹{plan.price}</span>
                  <span className="text-neutral-500 font-bold text-sm uppercase">{plan.period}</span>
                </div>
                <p className="text-on-surface-variant text-sm leading-relaxed">{plan.description}</p>
              </div>

              <div className="space-y-4 mb-10 flex-grow">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-green-400 text-lg">check_circle</span>
                    <span className="text-sm text-neutral-300 font-medium">{feature}</span>
                  </div>
                ))}
              </div>

              <button 
                onClick={() => handleSubscribe(plan.name, plan.price)}
                disabled={loadingPlan !== null || currentSubscription?.plan === plan.name}
                className={`w-full py-5 rounded-2xl text-sm font-black uppercase tracking-widest transition-all active:scale-95 shadow-xl flex items-center justify-center gap-2 ${plan.buttonClass} disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {loadingPlan === plan.name ? <span className="animate-spin material-symbols-outlined text-sm">progress_activity</span> : null}
                {currentSubscription?.plan === plan.name ? 'Current Plan' : `Choose ${plan.name}`}
              </button>
            </div>
          ))}
        </div>

        <p className="mt-16 text-xs text-neutral-500 font-medium">
          Need a custom enterprise solution? <a href="mailto:support@cadonce.com" className="text-yellow-400 hover:underline">Contact sales</a>
        </p>
      </div>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" />
    </div>
  );
}
