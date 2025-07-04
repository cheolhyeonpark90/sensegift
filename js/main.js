// js/main.js

import { getRecommendedKeywords, getSingleScoreRecommendedProducts } from './recommendation.js';
import { renderProducts, setupPagination, updateResultTitle, toggleLoader } from './ui.js';

// --- 상태 관리 ---
let allProducts = [];
let allRankings = [];
let currentFilteredProducts = [];
let currentPage = 1;
const PRODUCTS_PER_PAGE = 28;

// --- DOM 요소 ---
const productGrid = document.getElementById('product-grid');
const paginationContainer = document.getElementById('pagination-container');
const resultTitleElement = document.getElementById('result-title');
const loader = document.getElementById('loader');
const filterPanel = document.getElementById('filter-panel');
const filterTriggerBtn = document.getElementById('filter-trigger-btn');

// --- 정밀한 스크롤 함수 ---
function scrollToResults() {
    const targetElement = document.getElementById('product-section');
    if (targetElement) {
        const targetPosition = targetElement.getBoundingClientRect().top + window.scrollY;
        const offset = 10;
        window.scrollTo({
            top: targetPosition - offset,
            behavior: 'smooth'
        });
    }
}

// --- 데이터 로딩 및 초기화 ---
async function initializeApp() {
    toggleLoader(loader, true);
    try {
        const [productsResponse, rankingsResponse] = await Promise.all([
            fetch('../coupang_products.json'),
            fetch('../rankings.json')
        ]);

        if (!productsResponse.ok || !rankingsResponse.ok) {
            throw new Error('데이터 파일을 불러오는 데 실패했습니다.');
        }

        const coupangProducts = await productsResponse.json();
        allRankings = await rankingsResponse.json();
        
        allProducts = coupangProducts.map(p => ({
            ...p,
            id: p.productId,
            name: p.productName,
            price: p.productPrice,
            image: p.productImage,
            url: p.productUrl,
            category: p.categoryName || '기타',
        }));
        
        setupEventListeners();
        updateRecommendedProducts(); 

    } catch (error) {
        console.error("초기화 실패:", error);
        productGrid.innerHTML = `<div class="col-span-full text-center py-12">
            <p class="text-xl text-gray-500">상품 정보를 불러오는 데 실패했습니다.</p>
            <p class="text-gray-400 mt-2">페이지를 새로고침하거나 나중에 다시 시도해주세요.</p>
        </div>`;
    } finally {
        toggleLoader(loader, false);
    }
}

// --- 핵심 로직 ---
function updateRecommendedProducts(userProfile = { gender: null, age: null, interests: [] }, budget = null) {
    toggleLoader(loader, true);
    productGrid.innerHTML = '';
    paginationContainer.innerHTML = '';

    setTimeout(() => {
        const recommendedKeywords = getRecommendedKeywords(allRankings, userProfile);
        const weights = { relevance: 1.0, quality: 5.0, diversity: 10.0 };
        let finalList = getSingleScoreRecommendedProducts(allProducts, recommendedKeywords, weights);
        
        // ▼▼▼ 예산 필터 로직 추가 ▼▼▼
        if (budget) {
            finalList = finalList.filter(product => product.price <= parseInt(budget, 10));
        }

        currentFilteredProducts = finalList;
        updateResultTitle(resultTitleElement, userProfile);
        displayPage(1);
    }, 100);
}


function displayPage(page) {
    currentPage = page;
    toggleLoader(loader, false);

    const startIndex = (currentPage - 1) * PRODUCTS_PER_PAGE;
    const endIndex = startIndex + PRODUCTS_PER_PAGE;
    const paginatedProducts = currentFilteredProducts.slice(startIndex, endIndex);

    renderProducts(paginatedProducts, productGrid);
    setupPagination({
        container: paginationContainer,
        pageCount: Math.ceil(currentFilteredProducts.length / PRODUCTS_PER_PAGE),
        currentPage: currentPage,
        onPageClick: (pageNum) => {
            displayPage(pageNum);
            scrollToResults();
        }
    });
}

// --- 이벤트 리스너 설정 ---
function setupEventListeners() {
    const filterPanelContent = filterPanel.querySelector('div');
    filterPanelContent.innerHTML = getFilterHTML();

    filterTriggerBtn.addEventListener('click', () => {
        const isOpening = !filterPanel.classList.contains('open');
        filterPanel.classList.toggle('open');
        filterPanel.style.marginTop = isOpening ? '2rem' : '0';
        filterTriggerBtn.textContent = isOpening ? '닫기' : '선물 추천받기';
    });

    filterPanel.querySelector('.apply-btn').addEventListener('click', () => {
        const ageVal = filterPanel.querySelector('[data-filter-group="age"] .active')?.dataset.value || null;
        const genderVal = filterPanel.querySelector('[data-filter-group="gender"] .active')?.dataset.value || null;
        const budgetVal = filterPanel.querySelector('[data-filter-group="budget"] .active')?.dataset.value || null;
        
        const interestNodes = filterPanel.querySelectorAll('[data-filter-group="category"] .active');
        const interestVals = Array.from(interestNodes).map(node => node.dataset.value);
        
        const userProfile = {
            gender: genderVal,
            age: ageVal,
            interests: interestVals,
        };
        
        // 예산 값을 함께 전달
        updateRecommendedProducts(userProfile, budgetVal);
        
        filterPanel.classList.remove('open');
        filterPanel.style.marginTop = '0';
        filterTriggerBtn.textContent = '선물 추천받기';
        
        setTimeout(() => {
            scrollToResults();
        }, 500);
    });
    
    filterPanel.addEventListener('click', (e) => {
        const button = e.target.closest('button.filter-btn');
        if (!button) return;

        const group = button.closest('[data-filter-group]');
        if (!group) return;

        const groupName = group.dataset.filterGroup;

        if (groupName === 'category') {
            button.classList.toggle('active');
        } else {
            const currentActive = group.querySelector('.active');
            if (currentActive && currentActive !== button) {
                currentActive.classList.remove('active');
            }
            button.classList.toggle('active');
        }
    });
    
    const mobileMenu = document.getElementById('mobile-menu');
    const menuOverlay = document.getElementById('menu-overlay');
    document.getElementById('mobile-menu-btn').addEventListener('click', () => {
        mobileMenu.classList.add('open');
        menuOverlay.classList.remove('hidden');
        document.body.classList.add('overflow-hidden');
    });
    document.getElementById('mobile-menu-close-btn').addEventListener('click', () => {
        mobileMenu.classList.remove('open');
        menuOverlay.classList.add('hidden');
        document.body.classList.remove('overflow-hidden');
    });
    menuOverlay.addEventListener('click', () => {
        mobileMenu.classList.remove('open');
        menuOverlay.classList.add('hidden');
        document.body.classList.remove('overflow-hidden');
    });
}

function getFilterHTML() {
    // ▼▼▼ 예산 필터 HTML 복구 ▼▼▼
    return `
        <div>
            <label class="font-semibold text-gray-700 block mb-3 text-sm">나이대는?</label>
            <div class="flex flex-wrap gap-2" data-filter-group="age">
                <button class="filter-btn px-3 py-1.5 rounded-full" data-value="10대">10대</button>
                <button class="filter-btn px-3 py-1.5 rounded-full" data-value="20대">20대</button>
                <button class="filter-btn px-3 py-1.5 rounded-full" data-value="30대">30대</button>
                <button class="filter-btn px-3 py-1.5 rounded-full" data-value="40대">40대</button>
                <button class="filter-btn px-3 py-1.5 rounded-full" data-value="50대">50대</button>
                <button class="filter-btn px-3 py-1.5 rounded-full" data-value="60대 이상">60대+</button>
            </div>
        </div>
        <div>
            <label class="font-semibold text-gray-700 block mb-3 text-sm">성별은?</label>
            <div class="flex flex-wrap gap-2" data-filter-group="gender">
                <button class="filter-btn px-4 py-1.5 rounded-full" data-value="여성">여성</button>
                <button class="filter-btn px-4 py-1.5 rounded-full" data-value="남성">남성</button>
            </div>
        </div>
        <div>
            <label class="font-semibold text-gray-700 block mb-3 text-sm">어떤 분야에 관심있나요? (여러 개 선택 가능)</label>
            <div class="flex flex-wrap gap-2" data-filter-group="category">
                <button class="filter-btn px-3 py-1.5 rounded-full" data-value="패션의류">패션의류</button>
                <button class="filter-btn px-3 py-1.5 rounded-full" data-value="패션잡화">패션잡화</button>
                <button class="filter-btn px-3 py-1.5 rounded-full" data-value="화장품/미용">화장품/미용</button>
                <button class="filter-btn px-3 py-1.5 rounded-full" data-value="디지털/가전">디지털/가전</button>
                <button class="filter-btn px-3 py-1.5 rounded-full" data-value="가구/인테리어">가구/인테리어</button>
                <button class="filter-btn px-3 py-1.5 rounded-full" data-value="출산/육아">출산/육아</button>
                <button class="filter-btn px-3 py-1.5 rounded-full" data-value="식품">식품</button>
                <button class="filter-btn px-3 py-1.5 rounded-full" data-value="스포츠/레저">스포츠/레저</button>
                <button class="filter-btn px-3 py-1.5 rounded-full" data-value="생활/건강">생활/건강</button>
                <button class="filter-btn px-3 py-1.5 rounded-full" data-value="여가/생활편의">여가/생활편의</button>
                <button class="filter-btn px-3 py-1.5 rounded-full" data-value="도서">도서</button>
            </div>
        </div>
        <div>
            <label class="font-semibold text-gray-700 block mb-3 text-sm">예산은 어느정도인가요?</label>
            <div class="flex flex-wrap gap-2" data-filter-group="budget">
                <button class="filter-btn px-3 py-1.5 rounded-full" data-value="20000">~2만원</button>
                <button class="filter-btn px-3 py-1.5 rounded-full" data-value="30000">~3만원</button>
                <button class="filter-btn px-3 py-1.5 rounded-full" data-value="50000">~5만원</button>
                <button class="filter-btn px-3 py-1.5 rounded-full" data-value="100000">~10만원</button>
                <button class="filter-btn px-3 py-1.5 rounded-full" data-value="200000">~20만원</button>
                <button class="filter-btn px-3 py-1.5 rounded-full" data-value="9999999">상관없음</button>
            </div>
        </div>
        <button class="apply-btn w-full mt-6 text-white font-bold py-3 sm:py-4 rounded-xl text-base sm:text-lg">나만을 위한 선물 찾기</button>
    `;
}

// --- 앱 시작 ---
initializeApp();