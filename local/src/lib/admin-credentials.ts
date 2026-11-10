export const LOCAL_ADMIN_PASSWORD_MIN_LENGTH = 10;
export const USER_PASSWORD_MIN_LENGTH = 8;
export const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export function isValidEmail(email: string): boolean {
  if (!email || email.length > 254) return false;
  return EMAIL_REGEX.test(email.trim());
}

export const USER_CREDENTIAL_MESSAGES = {
  invalidJson: "请求格式有误，请刷新页面后重试",
  usernameRequired: "请输入用户名",
  usernameLength: "用户名长度需在 3 到 32 个字符之间",
  usernameInvalid: "用户名仅支持字母、数字、下划线及中文",
  passwordMinLength: `密码至少需要 ${USER_PASSWORD_MIN_LENGTH} 个字符`,
  passwordMismatch: "两次输入的密码不一致，请重新确认",
  userExists: "该用户名已被注册，请尝试其他用户名",
  emailRequired: "请输入邮箱地址",
  emailInvalid: "请输入有效的邮箱地址",
  emailExists: "该邮箱已被其他账号使用，请使用其他邮箱",
  emailNotFound: "该邮箱尚未注册，请先注册账号",
  codeRequired: "请输入 6 位验证码",
  codeInvalid: "验证码需为 6 位数字",
} as const;

export function getUserRegisterCredentialError(input: {
  username: string;
  password: string;
  passwordConfirm: string;
}): string {
  const username = input.username.trim();
  const password = input.password.trim();
  const passwordConfirm = input.passwordConfirm.trim();

  if (!username) return USER_CREDENTIAL_MESSAGES.usernameRequired;
  if (username.length < 3 || username.length > 32) return USER_CREDENTIAL_MESSAGES.usernameLength;
  if (!/^[a-zA-Z0-9_\-一-龥]+$/.test(username)) return USER_CREDENTIAL_MESSAGES.usernameInvalid;
  if (password.length < USER_PASSWORD_MIN_LENGTH) return USER_CREDENTIAL_MESSAGES.passwordMinLength;
  if (password !== passwordConfirm) return USER_CREDENTIAL_MESSAGES.passwordMismatch;
  return "";
}

export const LOCAL_ADMIN_CREDENTIAL_MESSAGES = {
  invalidJson: "请求格式有误，请刷新页面后重试",
  adminExists: "已有管理员账号，请直接登录",
  usernameRequired: "请输入管理员账号",
  passwordMinLength: `密码至少需要 ${LOCAL_ADMIN_PASSWORD_MIN_LENGTH} 个字符`,
  passwordMismatch: "两次输入的密码不一致，请重新确认",
} as const;

type LocalAdminCredentialInput = {
  username: string;
  password: string;
  passwordConfirm: string;
};

export function getLocalAdminSetupCredentialError(input: LocalAdminCredentialInput): string {
  const username = input.username.trim();
  const password = input.password.trim();
  const passwordConfirm = input.passwordConfirm.trim();

  if (!username) return LOCAL_ADMIN_CREDENTIAL_MESSAGES.usernameRequired;
  if (password.length < LOCAL_ADMIN_PASSWORD_MIN_LENGTH) return LOCAL_ADMIN_CREDENTIAL_MESSAGES.passwordMinLength;
  if (password !== passwordConfirm) return LOCAL_ADMIN_CREDENTIAL_MESSAGES.passwordMismatch;
  return "";
}
