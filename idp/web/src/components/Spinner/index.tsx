import React from 'react';
import styles from './index.module.css';

function Spinner() {
  return (
    <div className={styles.container}>
        <div className={styles.inside}></div>
    </div>
  );
}

export default Spinner;
