import { useState } from 'react';
import { FaCheckCircle, FaWallet } from 'react-icons/fa';
import {
  MIN_PIZZA_AMOUNT, parsePizzaAmount, sendPizzaSupport, SUPPORT_LABEL,
} from '../../services/pizzaSupportService';
import styles from './PizzaSupportPage.module.css';

const pizzas = [
  { amount: 5, name: 'A Slice', art: 'slice', description: 'A little slice to keep me going.' },
  { amount: 10, name: 'Half a Pizza', art: 'half', description: 'A generous half for the next stretch of work.' },
  { amount: 25, name: 'A Whole Pizza', art: 'whole', description: 'The whole pie. Dinner is sorted!' },
];

function PizzaArt({ kind }) {
  return (
    <span className={styles.plate} aria-hidden="true">
      {kind === 'boxes'
        ? <span className={styles.boxes}><i /><i /><i /></span>
        : <span className={`${styles.pizza} ${styles[kind]}`} />}
    </span>
  );
}

export default function PizzaSupportPage() {
  const [customAmount, setCustomAmount] = useState('');
  const [pending, setPending] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const send = async (value) => {
    if (pending !== null) return;
    const amount = parsePizzaAmount(value);
    if (amount === null) {
      setFeedback({ kind: 'error', text: 'Enter at least 1 QORT, with up to eight decimal places.' });
      return;
    }

    setPending(amount);
    setFeedback(null);
    try {
      const payment = await sendPizzaSupport(amount);
      setFeedback({ kind: 'success', text: `Thanks for the pizza! Your ${payment.amount} QORT payment was submitted.` });
    } catch (error) {
      const message = error?.message || (typeof error === 'string' ? error : '');
      setFeedback(/declin|cancel/i.test(message)
        ? { kind: 'cancelled', text: 'Pizza payment cancelled.' }
        : { kind: 'error', text: message || 'Could not send the pizza payment.' });
    } finally {
      setPending(null);
    }
  };

  return (
    <section className={styles.page} aria-labelledby="pizza-title">
      <header className={styles.hero}>
        <p className={styles.eyebrow}>Voluntary QORT contribution</p>
        <h1 id="pizza-title">{SUPPORT_LABEL}</h1>
        <p>Support my work with a voluntary QORT contribution.</p>
      </header>

      <div className={styles.feedback} aria-live="polite" aria-atomic="true">
        {pending !== null && <p><FaWallet aria-hidden="true" /> Check your Qortal wallet to confirm {pending} QORT.</p>}
        {feedback && <p className={styles[feedback.kind]}>
          {feedback.kind === 'success' && <FaCheckCircle aria-hidden="true" />}{feedback.text}
        </p>}
      </div>

      <div className={styles.menu}>
        {pizzas.map(({ amount, name, art, description }) => (
          <button key={amount} className={styles.card} type="button" onClick={() => void send(amount)}
            disabled={pending !== null} aria-label={`${name}, ${amount} QORT`}>
            <PizzaArt kind={art} />
            <span className={styles.cardTitle}>{name}</span>
            <span className={styles.description}>{description}</span>
            <span className={styles.price}>{amount} QORT</span>
          </button>
        ))}
        <form className={`${styles.card} ${styles.custom}`}
          onSubmit={(event) => { event.preventDefault(); void send(customAmount); }}>
          <PizzaArt kind="boxes" />
          <h2 className={styles.cardTitle}>Pizza Boxes</h2>
          <label htmlFor="pizza-amount">Custom amount in QORT</label>
          <input id="pizza-amount" type="text" inputMode="decimal"
            placeholder={`From ${MIN_PIZZA_AMOUNT} QORT`} value={customAmount}
            onChange={(event) => setCustomAmount(event.target.value)} disabled={pending !== null} />
          <button className={styles.price} type="submit" disabled={pending !== null || !customAmount.trim()}>
            Send pizza boxes
          </button>
        </form>
      </div>

      <p className={styles.note}>Pick a pizza, then confirm the one-time QORT gift in your Qortal wallet.</p>
    </section>
  );
}
