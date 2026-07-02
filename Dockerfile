# 사용할 기본 이미지
FROM node:20

# 컨테이너 안의 작업 폴더
WORKDIR /app

# package.json 복사
COPY package*.json ./

# 라이브러리 설치 (이미지를 만드는 동안 한 번 실행)
RUN npm install

# 프로젝트 전체 복사
COPY . .

# 8080 포트 사용
EXPOSE 8080

# 서버 실행
CMD ["npm", "start"]