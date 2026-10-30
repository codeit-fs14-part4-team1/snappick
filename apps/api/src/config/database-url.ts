type DatabaseCredentials = {
  username: string;
  password: string;
};

//secret parse
function parseDatabaseCredentials(secret: string): DatabaseCredentials {
  const credentials = JSON.parse(secret) as Partial<DatabaseCredentials>;

  if (!credentials.username || !credentials.password) {
    throw new Error('DB_CREDENTIALS의 형식이 올바르지 않습니다.');
  }

  return {
    username: credentials.username,
    password: credentials.password,
  };
}

//db url
export function getDatabaseUrl(): string {
  //local environment
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  //AWS environment
  const secret = process.env.DB_CREDENTIALS;
  const host = process.env.DB_HOST;
  const port = process.env.DB_PORT;
  const database = process.env.DB_NAME;

  if (!secret || !host || !port || !database) {
    throw new Error('데이터베이스 환경변수가 설정되지 않았습니다.');
  }

  const credentials = parseDatabaseCredentials(secret);

  const url = new URL('postgresql://localhost');
  url.username = encodeURIComponent(credentials.username);
  url.password = encodeURIComponent(credentials.password);
  url.hostname = host;
  url.port = port;
  url.pathname = database;

  // postgresql://사용자명:비밀번호@DB주소:포트/데이터베이스명
  return url.toString();
}
