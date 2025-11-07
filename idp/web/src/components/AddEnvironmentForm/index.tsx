
import React, { useContext } from 'react';
import { Formik, Field, Form, ErrorMessage, FieldArray } from 'formik';
import axios from 'axios';
import { UserContext } from '../../contexts/UserContext'
import EnvironmentDefinition from '../../types/EnvironmentDefinition';
import EnvironmentConfig from '../../types/EnvironmentConfig';
import { validateNotEmpty } from '../../utils'
import styles from './index.module.css';

function getInitialValues(): EnvironmentDefinition {
  return ({
    name: '',
    stack: '',
    config: [],
  })
}

function validateName(value?: string) {
  if (!value) {
    return 'Cannot be empty'
  }
  if (value.toLowerCase() !== value) {
    return 'Uppercase characters not allowed'
  }
  const length = value.trim().length;
  if (length && length > 32) {
    return 'Max. 32 characters allowed'
  }
  return value && value.match(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/) ? undefined : 'Name should match /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/'
}

export default function AddEnvironmentForm() {
  const { userState } = useContext(UserContext);
  return (
    <div className={styles.outerContainer}>
      <div className={styles.innerContainer}>
        <Formik
          initialValues={getInitialValues()}
          onSubmit={async (values, { resetForm }) => {
            const transformedValues = {
              ...values,
              environment: values.name,
              config: values.config.reduce((accumulator: object, entry: EnvironmentConfig) => ({
                ...accumulator,
                [entry.name]: entry.value
              }), {})
            }
            try {
              const response = await axios.post(`${process.env.REACT_APP_API_URL}/environments`, transformedValues, {
                headers: {
                  'Authorization': `Bearer ${userState.token}`
                }
              });
              if (response.status === 200 || response.status === 202) {
                resetForm();
              }
            } catch (e) {
              console.error(e)
            }
          }}
        >
          {({ values }) => (
            <Form>
              <div className={styles.form}>
                <div className={styles.requiredFieldsContainer}>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="name">Environment Name</label>
                    <Field id="name" name="name" className={styles.requiredField} validate={validateName} />
                    <ErrorMessage className={styles.errorMessage} name="name" component="div" />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="stack">Stack</label>
                    <Field id="stack" name="stack" className={styles.requiredField} validate={validateNotEmpty} />
                    <ErrorMessage className={styles.errorMessage} name="stack" component="div" />
                  </div>
                </div>
                <div className={styles.formConfigTableContainer}>
                  <FieldArray name="config">
                    {({ remove, push }) => (
                      <React.Fragment>
                        <table>
                          <thead>
                            <tr>
                              <th className={styles.tableHeading}>Config Name</th>
                              <th className={styles.tableHeading}>Config Value</th>
                              <th className={styles.tableHeading}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {values.config.length > 0 && values.config.map((entry, index) => (
                              <tr key={index}>
                                <td className={styles.configFieldCell}>
                                  <Field className={styles.configField} name={`config.${index}.name`} validate={validateNotEmpty} />
                                  <div>
                                    <ErrorMessage className={styles.errorMessage} name={`config.${index}.name`} component="div" />
                                  </div>
                                </td>
                                <td className={styles.configFieldCell}>
                                  <Field className={styles.configField} name={`config.${index}.value`} validate={validateNotEmpty} />
                                  <div>
                                    <ErrorMessage className={styles.errorMessage} name={`config.${index}.value`} component="div" />
                                  </div>
                                </td>
                                <td className={styles.configFieldCell}>
                                  <button className={styles.removeRowButton} type="button" onClick={() => remove(index)}>❌</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div className={styles.addRowButtonContainer} >
                          <button className={styles.addRowButton} type="button" onClick={() => push({ name: '', value: '' })}>+</button>
                        </div>
                      </React.Fragment>
                    )}
                  </FieldArray>
                </div>
              </div>
              <div className={styles.footer}>
                <h4 className={styles.title}>Create new environment</h4>
                <div className={styles.submitButtonContainer}>
                  <button type="submit">Create</button>
                </div>
              </div>
            </Form>
          )}
        </Formik>
      </div>
    </div>
  );
}
