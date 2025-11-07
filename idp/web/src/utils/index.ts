function validateNotEmpty(value?: string) {
  return value && value.trim().length > 0 ? undefined : 'Cannot be empty'
}

export {
  validateNotEmpty,
}
