import { Link } from 'react-router-dom';
import { FaDatabase, FaPizzaSlice, FaTimes, FaUserPlus } from 'react-icons/fa';
import { useAudienceActions } from '../../hooks/useAudienceActions';
import { SUPPORT_LABEL, SUPPORT_ROUTE } from '../../services/pizzaSupportService';
import styles from './AudienceActions.module.css';

function AudienceActions() {
  const {
    canFollow,
    closeFollow,
    follow,
    followMessage,
    followNames,
    isFollowOpen,
    isSubmittingFollow,
    notice,
    openFollow,
  } = useAudienceActions();

  return (
    <div className={styles.shell}>
      {notice && <div className={styles.notice}>{notice}</div>}

      <div className={styles.actions} role="group" aria-label="Audience actions">
        <button type="button" className={styles.actionButton} onClick={openFollow}>
          <span className={styles.iconBadge}>
            <FaUserPlus />
          </span>
          <span>Follow</span>
        </button>

        <Link to={SUPPORT_ROUTE} className={styles.actionButton}>
          <span className={styles.iconBadge}>
            <FaPizzaSlice aria-hidden="true" />
          </span>
          <span>{SUPPORT_LABEL}</span>
        </Link>
      </div>

      {isFollowOpen && (
        <div className={styles.modalBackdrop} role="presentation" onClick={closeFollow}>
          <section
            className={styles.followModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="follow-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button className={styles.modalClose} type="button" onClick={closeFollow} aria-label="Close">
              <FaTimes />
            </button>

            <p className={styles.eyebrow}>Qortal hosting support</p>
            <h2 id="follow-title">Follow iffi vaba mees</h2>
            <p>
              Following helps your local Qortal node mirror my published resources and makes this
              website easier for peers to retrieve.
            </p>

            <button
              className={styles.followChoice}
              type="button"
              onClick={follow}
              disabled={isSubmittingFollow || !canFollow || followNames.length === 0}
            >
              <FaDatabase />
              <span>
                <strong>Follow Website</strong>
                <small>{followNames.length > 0 ? followNames.join(', ') : 'No Qortal names found.'}</small>
              </span>
            </button>

            {!canFollow && (
              <p className={styles.followNote}>
                Open this website inside Qortal UI to enable follow controls.
              </p>
            )}
            {followMessage && (
              <p className={styles.followNote} role="status">
                {followMessage}
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

export default AudienceActions;
