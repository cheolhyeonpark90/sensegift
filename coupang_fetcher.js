/**
 * @file coupang_fetcher.js
 * @description .env 파일에서 API 키를 읽어와 쿠팡 상품 정보를 조회하고, 상품 URL을 딥링크로 변환하여 JSON으로 저장합니다.
 * @version 1.9.0
 */

// .env 파일의 환경 변수를 로드합니다. 반드시 다른 코드보다 위에 위치해야 합니다.
require('dotenv').config();

const axios = require('axios');
const crypto = require('crypto');
const moment = require('moment');
const fs = require('fs');
const path = require('path');

// --- 설정 (Configuration) ---

// process.env 객체를 통해 .env 파일의 값을 읽어옵니다.
const ACCESS_KEY = process.env.COUPANG_ACCESS_KEY;
const SECRET_KEY = process.env.COUPANG_SECRET_KEY;

// 테스트용 검색 키워드 목록
const KEYWORDS_TO_SEARCH = ["노트북", "기계식 키보드", "4K 모니터", "버티컬 마우스", "웹캠"];
const LIMIT = 5;
const OUTPUT_FILENAME = path.join(__dirname, 'coupang_products.json');
const DOMAIN = "https://api-gateway.coupang.com";

// API 경로 정의
const SEARCH_PATH = "/v2/providers/affiliate_open_api/apis/openapi/products/search";
const DEEPLINK_PATH = "/v2/providers/affiliate_open_api/apis/openapi/v1/deeplink";

/**
 * 쿠팡 파트너스 API 요청을 위한 HMAC 서명을 생성합니다.
 */
function generateHmac(method, path, query, secretKey, accessKey) {
    const datetime = moment.utc().format('YYMMDD[T]HHmmss[Z]');
    const message = datetime + method + path + (query ? query : "");
    const signature = crypto.createHmac('sha256', secretKey).update(message).digest('hex');
    return `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${datetime}, signature=${signature}`;
}

/**
 * 특정 키워드로 쿠팡 파트너스 상품을 검색합니다.
 */
async function searchProducts(keyword) {
    const queryString = `keyword=${encodeURIComponent(keyword)}&limit=${LIMIT}`;
    const url = `${SEARCH_PATH}?${queryString}`;
    const method = "GET";

    console.log(`'${keyword}' 키워드로 상품 검색을 시작합니다...`);

    try {
        const authorization = generateHmac(method, SEARCH_PATH, queryString, SECRET_KEY, ACCESS_KEY);
        const response = await axios.request({
            method: method,
            baseURL: DOMAIN,
            url: url,
            headers: { Authorization: authorization, 'Content-Type': 'application/json' },
        });

        if (response.data.rCode === "0" && response.data.data) {
            console.log(`'${keyword}' 키워드로 ${response.data.data.productData.length}개의 상품을 찾았습니다.`);
            return response.data.data.productData;
        } else {
            console.warn(`'${keyword}' 키워드 검색 결과가 비어있거나 오류가 발생했습니다: ${response.data.rMessage}`);
            return [];
        }
    } catch (error) {
        const errorMessage = error.response ? JSON.stringify(error.response.data) : error.message;
        console.error(`'${keyword}' 키워드 검색 중 API 요청 실패: ${errorMessage}`);
        return [];
    }
}

/**
 * 상품 객체 배열을 받아 "깨끗한" URL로 딥링크를 생성합니다.
 * @param {object[]} productsToConvert - 변환할 상품 객체 배열
 * @returns {Promise<Map<number, string>>} - <상품 ID, 단축 URL> 형태의 Map 객체
 */
async function getShortenedUrls(productsToConvert) {
    if (!productsToConvert || productsToConvert.length === 0) {
        return new Map();
    }
    
    const cleanUrls = productsToConvert.map(p => `https://www.coupang.com/vp/products/${p.productId}`);
    
    const urlToProductIdMap = new Map();
    productsToConvert.forEach(p => {
        urlToProductIdMap.set(`https://www.coupang.com/vp/products/${p.productId}`, p.productId);
    });

    console.log(`  딥링크 변환을 요청합니다... (${cleanUrls.length}개)`);
    const method = "POST";
    try {
        const authorization = generateHmac(method, DEEPLINK_PATH, '', SECRET_KEY, ACCESS_KEY);
        const response = await axios.request({
            method: method,
            baseURL: DOMAIN,
            url: DEEPLINK_PATH,
            headers: { Authorization: authorization, 'Content-Type': 'application/json' },
            data: { coupangUrls: cleanUrls } // 깨끗한 URL 목록을 전송
        });

        const productIdToShortenedUrlMap = new Map();
        if (response.data.rCode === "0" && response.data.data) {
            response.data.data.forEach(item => {
                const productId = urlToProductIdMap.get(item.originalUrl);
                if (productId) {
                    productIdToShortenedUrlMap.set(productId, item.shortenUrl);
                }
            });
            console.log(`  딥링크 변환 성공.`);
            return productIdToShortenedUrlMap;
        } else {
            console.warn(`  딥링크 변환 중 오류 발생: ${response.data.rMessage}`);
            console.error('  [Debug] 전체 응답:', JSON.stringify(response.data, null, 2));
            return productIdToShortenedUrlMap;
        }
    } catch (error) {
        console.error(`  딥링크 API 요청 실패!`);
        if (error.response) {
             console.error('  [Debug] 전체 오류 응답:', JSON.stringify(error.response.data, null, 2));
        } else {
             console.error('  [Debug] 오류 메시지:', error.message);
        }
        return new Map();
    }
}


/**
 * 메인 실행 함수
 */
async function main(keywords) {
    console.log("🚀 쿠팡 파트너스 상품 정보 수집 스크립트를 시작합니다.");
    
    if (!ACCESS_KEY || !SECRET_KEY) {
        console.error("❗ .env 파일에 COUPANG_ACCESS_KEY 또는 COUPANG_SECRET_KEY가 설정되지 않았습니다. .env 파일을 확인해주세요.");
        return;
    }

    if (!keywords || keywords.length === 0) {
        console.warn("검색할 키워드 목록이 비어있습니다. 스크립트를 종료합니다.");
        return;
    }
    console.log(`검색 대상 키워드: ${keywords.join(', ')}`);

    // [수정] 기존 coupang_products.json 파일을 읽어서 메모리에 로드합니다.
    let allProducts = new Map();
    if (fs.existsSync(OUTPUT_FILENAME)) {
        try {
            const existingData = JSON.parse(fs.readFileSync(OUTPUT_FILENAME, 'utf-8'));
            existingData.forEach(item => allProducts.set(item.productId.toString(), item));
            console.log(`기존 데이터 ${allProducts.size}개를 불러왔습니다.`);
        } catch (e) {
            console.warn("기존 데이터 파일을 읽는 데 실패했습니다.");
        }
    } else {
        console.log("기존 데이터 파일이 없습니다. 새로운 파일을 생성합니다.");
    }


    for (const keyword of keywords) {
        const products = await searchProducts(keyword);

        // 새로 발견된 상품만 필터링합니다.
        const newProducts = products.filter(p => !allProducts.has(p.productId.toString()));

        if (newProducts.length > 0) {
            // 새로운 상품에 대해서만 딥링크를 요청합니다.
            const shortenedUrlMap = await getShortenedUrls(newProducts);

            // 새로운 상품들의 productUrl을 딥링크로 업데이트합니다.
            newProducts.forEach(product => {
                if (shortenedUrlMap.has(product.productId)) {
                    product.productUrl = shortenedUrlMap.get(product.productId);
                }
            });
        }

        // 검색된 모든 상품에 대해 키워드 및 순위 업데이트, 또는 신규 추가를 진행합니다.
        products.forEach(product => {
            const productIdStr = product.productId.toString();
            if (allProducts.has(productIdStr)) {
                // 이미 존재하는 상품일 경우
                const existingProduct = allProducts.get(productIdStr);
                // 키워드 추가 (중복 방지)
                if (!existingProduct.keywords.includes(keyword)) {
                    existingProduct.keywords.push(keyword);
                    console.log(`  - 기존 상품(${productIdStr})에 '${keyword}' 키워드를 추가했습니다.`);
                }
                // 순위 비교 및 업데이트
                if (product.rank < existingProduct.rank) {
                    console.log(`  - 상품(${productIdStr})의 순위가 더 높아(${existingProduct.rank} -> ${product.rank}) 업데이트합니다.`);
                    existingProduct.rank = product.rank;
                }
            } else {
                // 새로운 상품일 경우 (newProducts 배열에 있던 상품)
                // URL은 이미 딥링크로 변환되었으므로 그대로 Map에 추가합니다.
                product.keywords = [keyword];
                allProducts.set(productIdStr, product);
                console.log(`  + 새로운 상품(${productIdStr}) '${product.productName.substring(0, 20)}...' 을(를) 추가했습니다.`);
            }
        });
        await new Promise(resolve => setTimeout(resolve, 1500));
    }

    if (allProducts.size > 0) {
        const productArray = Array.from(allProducts.values());
        fs.writeFileSync(OUTPUT_FILENAME, JSON.stringify(productArray, null, 2), 'utf-8');
        console.log(`✅ 총 ${productArray.length}개의 상품 정보를 '${OUTPUT_FILENAME}' 파일에 성공적으로 저장했습니다.`);
    } else {
        console.log("저장할 상품 정보가 없습니다.");
    }

    console.log("🎉 스크립트 실행이 완료되었습니다.");
}

main(KEYWORDS_TO_SEARCH).catch(error => {
    console.error("스크립트 실행 중 예기치 않은 오류가 발생했습니다:", error);
    process.exit(1);
});
