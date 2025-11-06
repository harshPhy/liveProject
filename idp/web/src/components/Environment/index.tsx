import React, { useState } from 'react';
import axios from 'axios';
import EnvironmentConfig from '../../types/EnvironmentConfig';
import EnvironmentState from '../../types/EnvironmentState';
import './index.css'
import styles from './index.module.css'

export default function Environment(props: { data: EnvironmentState }) {

  const [expanded, setExpanded] = useState(false);
  const [canSubmit, setCanSubmit] = useState(true);

  async function handleTrClick() {
    setExpanded((prevState: boolean) => !prevState)
  }
  async function handleDestroyButtonClick(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    setCanSubmit(false)

    try {
      const response = await axios.delete(`${process.env.REACT_APP_API_URL}/environments/${props.data.name}`);
      if (response.status !== 200 && response.status !== 202) {
        setCanSubmit(true)
      }
    } catch (e) {
      console.error(e);
    }
  }
  return (<>
    <tr className={`${styles.row} ${props.data.status.toLowerCase()}__row ${expanded ? 'row__expanded' : ''}`} onClick={handleTrClick}>
      <td>{props.data.name}</td>
      <td>{props.data.stack}</td>
      <td className={`status__${props.data.status.toLowerCase()}`}>{props.data.status}</td>
    </tr>
    {expanded &&
      <tr className={`${styles.details} ${props.data.status.toLowerCase()}__details`}>
        <td colSpan={3}>
          <div>
            {props.data.config &&
              <table className={styles.configTable}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {props.data.config.map((config: EnvironmentConfig) => (
                    <tr key={config.name}>
                      <td className={styles.configEntry}>{config.name}</td>
                      <td className={styles.configEntry}>{config.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            }
            <p className={styles.notes}>{props.data.note || '<blank>'}</p>
            <button disabled={!canSubmit || props.data.status !== 'DEPLOYED'} onClick={handleDestroyButtonClick}>Destroy</button>
          </div>
        </td>
      </tr>}
  </>)
}
