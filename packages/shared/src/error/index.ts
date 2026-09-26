/** Business error codes sent as `error.code`; the frontend shows ERROR_CODE_TEXT_MAP[code] to the user. */
export enum ERROR_CODE {
  DUPLICATE_USERNAME = 'DUPLICATE_USERNAME',
  DUPLICATE_TAG_NAME = 'DUPLICATE_TAG_NAME',
}

export const ERROR_CODE_TEXT_MAP: Record<keyof typeof ERROR_CODE, string> = {
  DUPLICATE_USERNAME: 'This username is already taken.',
  DUPLICATE_TAG_NAME: 'A tag with this name already exists.',
};
