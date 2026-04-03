import styles from './AppShell.module.css'

export default function AppShell({ studentName, tala, leftChildren, rightChildren, onEditName }) {
  return (
    <div className={styles.wrapper}>
      <nav className={styles.nav}>
        <div className={styles.navAlonFace}>🦅</div>
        <div className={styles.navText}>
          <h1>AralMate</h1>
          <p>Ang Kasama Mo sa Pag-aaral</p>
        </div>
        <div className={styles.navRight}>
          <div className={styles.navBadge}>⭐ {tala}</div>
          <button className={styles.editBtn} onClick={onEditName} title="Change name">✏️</button>
        </div>
      </nav>
      <div className={styles.columns}>
        <div className={styles.colLeft}>{leftChildren}</div>
        <div className={styles.colRight}>{rightChildren}</div>
      </div>
    </div>
  )
}
