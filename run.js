/**
 * @file run.js
 * @description [완성본] 1. 네이버 데이터랩에서 상세 키워드 정보를 크롤링하여 rankings.json으로 저장하고, 2. API 호출 제한을 지키며 쿠팡 상품 정보를 수집/변환하여 coupang_products.json으로 저장합니다.
 * @version 4.2.0
 */

// .env 파일의 환경 변수를 로드합니다. (가장 위에 위치해야 함)
require('dotenv').config();

// 필요한 모든 라이브러리를 가져옵니다.
const { chromium } = require('playwright');
const axios = require('axios');
const crypto = require('crypto');
const moment = require('moment');
const fs = require('fs');
const path = require('path');
const { RateLimiter } = require('limiter');

// =======================================================================
// PART 1: 네이버 데이터랩 크롤러 (crawler.js 로직)
// =======================================================================

const NAVER_SELECTORS = {
    categoryDropdown: '#content > div.section_instie_area.space_top > div > div.section.insite_inquiry > div > div > div:nth-child(1) > div > div:nth-child(1)',
    periodDropdown: '#content > div.section_instie_area.space_top > div > div.section.insite_inquiry > div > div > div:nth-child(2) > div.set_period > div',
    deviceAll: '#\\31 8_device_0',
    gender: { all: '#\\31 9_gender_0', female: '#\\31 9_gender_1', male: '#\\31 9_gender_2' },
    age: { all: '#\\32 0_age_0', '10s': '#\\32 0_age_1', '20s': '#\\32 0_age_2', '30s': '#\\32 0_age_3', '40s': '#\\32 0_age_4', '50s': '#\\32 0_age_5', '60s': '#\\32 0_age_6' },
    searchButton: '#content > div.section_instie_area.space_top > div > div.section.insite_inquiry > div > a',
    resultsContainer: '#content > div.section_instie_area.space_top > div > div:nth-child(2) > div.section_insite_sub',
    rankListContainer: '.rank_top1000_list',
    rankList: '.rank_top1000_list > li',
    rankNumber: '.rank_top1000_num',
    keywordLink: '.link_text',
};

const NAVER_CATEGORIES = [
  { name: '패션의류', cid: '50000000' }, 
//   { name: '패션잡화', cid: '50000001' }, { name: '화장품/미용', cid: '50000002' }, { name: '디지털/가전', cid: '50000003' }, { name: '가구/인테리어', cid: '50000004' }, { name: '출산/육아', cid: '50000005' }, { name: '식품', cid: '50000006' }, { name: '스포츠/레저', cid: '50000007' }, { name: '생활/건강', cid: '50000008' }, { name: '여가/생활편의', cid: '50000009' }, { name: '도서', cid: '50005542' },
];
const GENDERS = [ { name: '전체', selector: NAVER_SELECTORS.gender.all }, { name: '여성', selector: NAVER_SELECTORS.gender.female }, { name: '남성', selector: NAVER_SELECTORS.gender.male } ];
const AGES = [ { name: '전체', selector: NAVER_SELECTORS.age.all }, { name: '10대', selector: NAVER_SELECTORS.age['10s'] }, { name: '20대', selector: NAVER_SELECTORS.age['20s'] }, { name: '30대', selector: NAVER_SELECTORS.age['30s'] }, { name: '40대', selector: NAVER_SELECTORS.age['40s'] }, { name: '50대', selector: NAVER_SELECTORS.age['50s'] }, { name: '60대 이상', selector: NAVER_SELECTORS.age['60s'] } ];


/**
 * [크롤러 헬퍼] 페이지 필터를 설정하고 '조회하기' 버튼을 클릭합니다. (원본 로직 복원)
 */
async function setFiltersAndSearch(page, category, gender, age) {
    console.log(`  - [설정] 분야: ${category.name}, 성별: ${gender.name}, 연령: ${age.name}`);
    
    const categoryDropdownLocator = page.locator(NAVER_SELECTORS.categoryDropdown);
    const categoryLinkLocator = categoryDropdownLocator.locator(`a[data-cid="${category.cid}"]`);

    await categoryDropdownLocator.click();
    await page.waitForTimeout(200);

    await categoryLinkLocator.waitFor({ state: 'visible', timeout: 5000 });
    await categoryLinkLocator.click({ force: true });
    await page.waitForTimeout(200);

    const periodDropdownLocator = page.locator(NAVER_SELECTORS.periodDropdown);
    await periodDropdownLocator.click();
    await page.waitForTimeout(200);
    await periodDropdownLocator.locator(`a:text("주간")`).click();
    await page.waitForTimeout(200);

    await page.locator(NAVER_SELECTORS.deviceAll).click();
    await page.locator(gender.selector).click();
    await page.locator(age.selector).click();

    await page.locator(NAVER_SELECTORS.searchButton).click();
    
    await page.waitForSelector(NAVER_SELECTORS.resultsContainer, { state: 'visible', timeout: 60000 });
    await page.waitForTimeout(500); // 결과 컨테이너 로딩 후 안정화를 위한 대기
}

/**
 * [크롤러 헬퍼] 현재 페이지에서 TOP 20위까지의 키워드 순위를 추출합니다.
 */
async function scrapeRankings(page) {
    const rankings = [];
    const listItems = await page.locator(NAVER_SELECTORS.rankList).all();
    for (const item of listItems) {
        const rankText = await item.locator(NAVER_SELECTORS.rankNumber).innerText();
        const keywordText = await item.locator(NAVER_SELECTORS.keywordLink).innerText();
        const rank = parseInt(rankText.trim(), 10);
        const keyword = keywordText.replace(rankText, '').trim();
        if (!isNaN(rank) && keyword) {
            rankings.push({ rank, keyword });
        }
    }
    return rankings;
}


/**
 * 네이버 데이터랩에서 상세 키워드 정보를 크롤링하고, 파일로 저장한 뒤, 유니크한 키워드 목록을 반환합니다.
 * @returns {Promise<string[]>}
 */
async function fetchKeywordsFromNaver() {
    console.log('>> STEP 1: 네이버 데이터랩 크롤링을 시작합니다...');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const initialUrl = 'https://datalab.naver.com/shoppingInsight/sCategory.naver';
    let rawData = [];
    const uniqueKeywords = new Set();

    try {
        for (const category of NAVER_CATEGORIES) {
            for (const gender of GENDERS) {
                for (const age of AGES) {
                    await page.goto(initialUrl, { waitUntil: 'networkidle' });
                    
                    await setFiltersAndSearch(page, category, gender, age);

                    if (await page.locator(NAVER_SELECTORS.rankListContainer).isVisible()) {
                        const keywords = await scrapeRankings(page);
                        const ageGenderLabel = (gender.name !== '전체' && age.name !== '전체') ? `${gender.name}_${age.name}` : null;
                        
                        keywords.forEach(k => {
                            rawData.push({ ...k, category: category.name, gender: gender.name, age: age.name, ageGenderLabel });
                            uniqueKeywords.add(k.keyword);
                        });
                        console.log(`    [추출 완료] 키워드 ${keywords.length}개 추출`);
                    } else {
                        console.log(`    [정보] 추출할 순위 데이터가 없습니다.`);
                    }
                    // 원본의 젠틀한 크롤링을 위한 랜덤 딜레이로 복원
                    await page.waitForTimeout(2000 + Math.random() * 1500);
                }
            }
        }
    } catch (error) {
        console.error('❌ 네이버 데이터랩 크롤링 중 오류 발생:', error);
        await page.screenshot({ path: 'error_screenshot.png' });
    } finally {
        await browser.close();
    }

    console.log('\n  - 크롤링 데이터 가공 및 rankings.json 파일 저장 중...');
    const finalRankingData = processRawDataForRankings(rawData, NAVER_CATEGORIES);
    fs.writeFileSync('rankings.json', JSON.stringify(finalRankingData, null, 2), 'utf-8');
    console.log('  ✅ rankings.json 파일이 성공적으로 생성되었습니다.');
    
    const keywordsToReturn = Array.from(uniqueKeywords);
    console.log(`✅ 네이버 크롤링 완료. 총 ${keywordsToReturn.length}개의 유니크 키워드 수집.\n`);
    return keywordsToReturn;
}

/**
 * 크롤링한 원시 데이터를 rankings.json 형식으로 가공합니다.
 */
function processRawDataForRankings(rawData, allCategories) {
    const keywordMap = new Map();
    const categoryNames = new Set(allCategories.map(c => c.name));

    rawData.forEach(item => {
        const { keyword, rank, category, gender, age, ageGenderLabel } = item;
        if (!keywordMap.has(keyword)) {
            const newKeywordEntry = { keyword, rankingsByCategory: {}, lastUpdated: new Date().toISOString() };
            categoryNames.forEach(catName => { newKeywordEntry.rankingsByCategory[catName] = null; });
            keywordMap.set(keyword, newKeywordEntry);
        }
        
        const keywordEntry = keywordMap.get(keyword);
        if (!keywordEntry.rankingsByCategory[category]) {
            keywordEntry.rankingsByCategory[category] = { overall: null, byGender: {}, byAge: {}, byAgeGender: {} };
        }

        const categoryData = keywordEntry.rankingsByCategory[category];
        if (gender === '전체' && age === '전체') categoryData.overall = rank;
        else if (age === '전체') categoryData.byGender[gender] = rank;
        else if (gender === '전체') categoryData.byAge[age] = rank;
        else categoryData.byAgeGender[ageGenderLabel] = rank;
    });

    return Array.from(keywordMap.values());
}


// =======================================================================
// PART 2: 쿠팡 상품 수집기 (coupang_fetcher.js 로직)
// =======================================================================

const ACCESS_KEY = process.env.COUPANG_ACCESS_KEY;
const SECRET_KEY = process.env.COUPANG_SECRET_KEY;
const LIMIT = 5;
const OUTPUT_FILENAME = path.join(__dirname, 'coupang_products.json');
const DOMAIN = "https://api-gateway.coupang.com";
const SEARCH_PATH = "/v2/providers/affiliate_open_api/apis/openapi/products/search";
const DEEPLINK_PATH = "/v2/providers/affiliate_open_api/apis/openapi/v1/deeplink";

// [수정] API 호출 제한을 분당 70회로 설정 (루프당 2회 소모 -> 분당 35개 키워드 처리)
const limiter = new RateLimiter({ tokensPerInterval: 70, interval: 60000 });

function generateHmac(method, path, query, secretKey, accessKey) {
    const datetime = moment.utc().format('YYMMDD[T]HHmmss[Z]');
    const message = datetime + method + path + (query ? query : "");
    const signature = crypto.createHmac('sha256', secretKey).update(message).digest('hex');
    return `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${datetime}, signature=${signature}`;
}

async function searchProducts(keyword) {
    const queryString = `keyword=${encodeURIComponent(keyword)}&limit=${LIMIT}`;
    const url = `${SEARCH_PATH}?${queryString}`;
    try {
        const authorization = generateHmac("GET", SEARCH_PATH, queryString, SECRET_KEY, ACCESS_KEY);
        const response = await axios.request({ method: "GET", baseURL: DOMAIN, url, headers: { "Authorization": authorization, 'Content-Type': 'application/json' }});
        return response.data?.data?.productData || [];
    } catch (error) {
        console.error(`  ❌ '${keyword}' 검색 실패:`, error.response?.data?.message || error.message);
        return [];
    }
}

async function getShortenedUrls(productsToConvert) {
    if (!productsToConvert || productsToConvert.length === 0) return new Map();
    const cleanUrls = productsToConvert.map(p => `https://www.coupang.com/vp/products/${p.productId}`);
    const urlToProductIdMap = new Map(productsToConvert.map(p => [`https://www.coupang.com/vp/products/${p.productId}`, p.productId]));
    
    try {
        const authorization = generateHmac("POST", DEEPLINK_PATH, '', SECRET_KEY, ACCESS_KEY);
        const response = await axios.request({ method: "POST", baseURL: DOMAIN, url: DEEPLINK_PATH, headers: { "Authorization": authorization, 'Content-Type': 'application/json' }, data: { coupangUrls: cleanUrls }});
        const resultMap = new Map();
        if (response.data?.data) {
            response.data.data.forEach(item => {
                const productId = urlToProductIdMap.get(item.originalUrl);
                if (productId) resultMap.set(productId, item.shortenUrl);
            });
        }
        return resultMap;
    } catch (error) {
        console.error(`  ❌ 딥링크 변환 실패:`, error.response?.data?.message || error.message);
        return new Map();
    }
}

async function processCoupangProducts(keywords) {
    console.log(">> STEP 2: 쿠팡 상품 정보 수집을 시작합니다...");
    if (!ACCESS_KEY || !SECRET_KEY) {
        console.error("❗ .env 파일에 COUPANG_ACCESS_KEY 또는 COUPANG_SECRET_KEY가 없습니다.");
        return;
    }
    if (!keywords || keywords.length === 0) {
        console.warn("처리할 키워드가 없습니다.");
        return;
    }

    // 1. 참조용으로만 기존 데이터를 로드합니다.
    let referenceProducts = new Map();
    if (fs.existsSync(OUTPUT_FILENAME)) {
        try {
            const existingData = JSON.parse(fs.readFileSync(OUTPUT_FILENAME, 'utf-8'));
            existingData.forEach(item => referenceProducts.set(item.productId.toString(), item));
            console.log(`  - 참조용 기존 데이터 ${referenceProducts.size}개를 불러왔습니다.`);
        } catch (e) {
            console.warn("  - 기존 데이터 파일을 읽는 데 실패했습니다.");
        }
    }

    // 2. 이번 실행의 결과를 담을 새로운 Map을 생성합니다.
    let currentRunProducts = new Map();

    // 3. 모든 키워드를 순회하며 상품 정보를 수집하고 즉시 처리합니다.
    for (const keyword of keywords) {
        // 루프 시작 시, 검색(1)+딥링크(1)에 필요한 토큰 2개를 미리 소모합니다.
        await limiter.removeTokens(2);
        
        console.log(`[API 호출] '${keyword}' 키워드로 상품 검색...`);
        const products = await searchProducts(keyword);

        // 3-1. 이번 검색 결과에서 딥링크가 필요한 새 상품만 필터링합니다.
        const productsThatNeedDeeplink = products.filter(p => 
            !referenceProducts.has(p.productId.toString()) && 
            !currentRunProducts.has(p.productId.toString())
        );

        // 3-2. 필요한 경우에만 딥링크 API를 호출합니다.
        let shortenedUrlMap = new Map();
        if (productsThatNeedDeeplink.length > 0) {
            console.log(`  - 새로운 상품 ${productsThatNeedDeeplink.length}개에 대한 딥링크 변환 요청...`);
            shortenedUrlMap = await getShortenedUrls(productsThatNeedDeeplink);
        }
        
        // 3-3. 이번 검색 결과를 최종 목록에 추가하거나 업데이트합니다.
        products.forEach(product => {
            const productIdStr = product.productId.toString();
            if (currentRunProducts.has(productIdStr)) {
                // 이번 실행에서 이미 발견된 상품이면 키워드와 순위만 업데이트합니다.
                const existingProduct = currentRunProducts.get(productIdStr);
                if (!existingProduct.keywords.includes(keyword)) {
                    existingProduct.keywords.push(keyword);
                }
                if (product.rank < existingProduct.rank) {
                    existingProduct.rank = product.rank;
                }
            } else {
                // 이번 실행에서 처음 발견된 상품이면...
                // URL을 결정합니다: (1)방금 받은 딥링크 (2)참조용 기존 딥링크 (3)원본 URL
                if (shortenedUrlMap.has(product.productId)) {
                    product.productUrl = shortenedUrlMap.get(product.productId);
                } else if (referenceProducts.has(productIdStr)) {
                    product.productUrl = referenceProducts.get(productIdStr).productUrl;
                }
                // 그 외의 경우는 원본 URL이 그대로 유지됩니다.

                // 최종 목록에 추가합니다.
                product.keywords = [keyword];
                currentRunProducts.set(productIdStr, product);
            }
        });
    }
    
    // 4. 최종 결과를 파일에 덮어씁니다. (순위에서 밀려난 상품은 자동으로 제거됨)
    if (currentRunProducts.size > 0) {
        const productArray = Array.from(currentRunProducts.values());
        fs.writeFileSync(OUTPUT_FILENAME, JSON.stringify(productArray, null, 2), 'utf-8');
        console.log(`\n✅ 최종 완료. 총 ${productArray.length}개의 상품 정보를 '${OUTPUT_FILENAME}'에 저장했습니다.`);
    } else {
        console.log("\n저장할 상품 정보가 없습니다.");
    }
}

// =======================================================================
// 최종 실행
// =======================================================================
(async () => {
    // 1단계: 네이버에서 키워드 수집 및 rankings.json 저장
    const keywords = await fetchKeywordsFromNaver();
    
    // 2단계: 수집된 키워드로 쿠팡 상품 정보 처리 및 coupang_products.json 저장
    await processCoupangProducts(keywords);

    console.log("\n🎉 모든 작업이 완료되었습니다.");
})();
