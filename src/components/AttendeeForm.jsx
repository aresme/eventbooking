import { useState } from 'react'
import { Field, Input, Select } from './ui/form'
import { normalizePhone, SCHOOLS } from '@/lib/utils'

const STORE_KEY = 'uv_attendee'

export function loadSavedDetails() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY)) || {}
  } catch {
    return {}
  }
}

function saveDetails(d) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ fullName: d.fullName, phone: d.phone, email: d.email, regNumber: d.regNumber, school: d.school }))
  } catch {
    /* ignore */
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateAttendee(values, isSchool) {
  const errors = {}
  if (values.fullName.trim().length < 3) errors.fullName = 'Enter your full name'
  if (!normalizePhone(values.phone)) errors.phone = 'Enter a valid Kenyan number, e.g. 0712 345 678'
  if (values.email && !EMAIL.test(values.email.trim())) errors.email = 'Enter a valid email or leave it empty'
  if (isSchool && !values.regNumber.trim()) errors.regNumber = 'Registration number is required for school events'
  if (isSchool && !values.school) errors.school = 'Select your school'
  return errors
}

export function cleanAttendee(values, isSchool) {
  const clean = {
    fullName: values.fullName.trim().replace(/\s+/g, ' '),
    phone: normalizePhone(values.phone),
    email: values.email.trim().toLowerCase(),
    regNumber: isSchool ? values.regNumber.trim().toUpperCase() : '',
    school: isSchool ? values.school : '',
  }
  saveDetails({ ...clean, regNumber: values.regNumber, school: values.school })
  return clean
}

export function useAttendeeForm() {
  const saved = loadSavedDetails()
  const [values, setValues] = useState({
    fullName: saved.fullName || '',
    phone: saved.phone || '',
    email: saved.email || '',
    regNumber: saved.regNumber || '',
    school: saved.school || '',
  })
  const [errors, setErrors] = useState({})
  const set = (k) => (e) => {
    setValues((v) => ({ ...v, [k]: e.target.value }))
    if (errors[k]) setErrors((er) => ({ ...er, [k]: undefined }))
  }
  return { values, errors, setErrors, set }
}

export function AttendeeFields({ form, isSchool, emailHint }) {
  const { values, errors, set } = form
  return (
    <div className="space-y-4">
      <Field label="Full name" error={errors.fullName}>
        {(p) => <Input {...p} value={values.fullName} onChange={set('fullName')} autoComplete="name" placeholder="Jane Wanjiku" />}
      </Field>
      <Field label="Phone number" error={errors.phone}>
        {(p) => <Input {...p} value={values.phone} onChange={set('phone')} type="tel" inputMode="tel" autoComplete="tel" placeholder="0712 345 678" />}
      </Field>
      <Field label="Email" optional error={errors.email} hint={emailHint}>
        {(p) => <Input {...p} value={values.email} onChange={set('email')} type="email" autoComplete="email" placeholder="you@students.ac.ke" />}
      </Field>
      {isSchool && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Registration no." error={errors.regNumber}>
            {(p) => <Input {...p} value={values.regNumber} onChange={set('regNumber')} placeholder="SCT211-0001/2024" />}
          </Field>
          <Field label="School" error={errors.school}>
            {(p) => (
              <Select {...p} value={values.school} onChange={set('school')}>
                <option value="">Select school</option>
                {SCHOOLS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
            )}
          </Field>
        </div>
      )}
    </div>
  )
}
