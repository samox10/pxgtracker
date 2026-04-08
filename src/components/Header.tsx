import Link from "next/link";
import styles from "./Header.module.css";

export default function Header() {
  return (
    <header className={styles.header}>
      <Link href="/" className={styles.logoContainer}>
        <div className={styles.logoSymbol}></div>
        <div className={styles.logoText}>
          PXG<span className={styles.logoHighlight}>Tracker</span>
        </div>
      </Link>

      <nav className={styles.nav}>
        <Link href="/" className={styles.navLink}>Dashboard</Link>
        <Link href="/registrar-hunt" className={styles.navLink}>Registrar Hunt</Link>
        <Link href="/registrar-secret-lab" className={styles.navLink}>Secret Lab</Link>
        <Link href="/profissao" className={styles.navLink}>Profissão</Link>
        {/* Nova aba de Compras adicionada aqui: */}
        <Link href="/compras-market" className={styles.navLink}>Compras do Market</Link>
        <Link href="/inventario" className={styles.navLink}>Inventário</Link>
        <Link href="/gastos" className={styles.navLink}>Gastos</Link>
      </nav>
    </header>
  );
}