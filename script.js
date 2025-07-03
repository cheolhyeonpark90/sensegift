document.addEventListener('DOMContentLoaded', () => {

    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenuCloseBtn = document.getElementById('mobile-menu-close-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    const menuOverlay = document.getElementById('menu-overlay');

    const openMenu = () => {
        mobileMenu.classList.add('open');
        menuOverlay.classList.add('active');
        menuOverlay.classList.remove('hidden');
        document.body.classList.add('overflow-hidden');
    };

    const closeMenu = () => {
        mobileMenu.classList.remove('open');
        menuOverlay.classList.remove('active');
        menuOverlay.classList.add('hidden');
        document.body.classList.remove('overflow-hidden');
    };

    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', openMenu);
    }
    if (mobileMenuCloseBtn) {
        mobileMenuCloseBtn.addEventListener('click', closeMenu);
    }
    if (menuOverlay) {
        menuOverlay.addEventListener('click', closeMenu);
    }

    const allProducts = [
        { id: 1, name: '브랜드 시그니처 토트백', price: 195000, category: '패션잡화', image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?q=80&w=400', recommendedAges: [20, 30], gender: 'female' },
        { id: 2, name: '클래식 파일럿 손목시계', price: 350000, category: '패션잡화', image: 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?q=80&w=400', recommendedAges: [30, 40, 50], gender: 'male' },
        { id: 3, name: '프리미엄 호텔 디퓨저', price: 55000, category: '가구/인테리어', image: 'https://images.unsplash.com/photo-1587055038039-44ab4a45333f?q=80&w=400', recommendedAges: [20, 30, 40], gender: 'all' },
        { id: 4, name: '노이즈캔슬링 무선 이어폰', price: 250000, category: '디지털/가전', image: 'https://images.unsplash.com/photo-1606220584214-9563332152a7?q=80&w=400', recommendedAges: [10, 20, 30], gender: 'all' },
        { id: 5, name: '캐시미어 크루넥 스웨터', price: 110000, category: '패션의류', image: 'https://images.unsplash.com/photo-1616252994232-a563a6e69315?q=80&w=400', recommendedAges: [30, 40], gender: 'male' },
        { id: 6, name: '크리스탈 와인잔 세트', price: 70000, category: '생활/건강', image: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?q=80&w=400', recommendedAges: [30, 40, 50], gender: 'all' },
        { id: 7, name: '안티에이징 스킨케어 세트', price: 150000, category: '화장품/미용', image: 'https://images.unsplash.com/photo-1590439471364-192aa70c0b53?q=80&w=400', recommendedAges: [40, 50], gender: 'female'},
        { id: 8, name: '오가닉 아기 내복 세트', price: 45000, category: '출산/육아', image: 'https://images.unsplash.com/photo-1525999147711-835474620964?q=80&w=400', recommendedAges: [20, 30], gender: 'all' },
        { id: 9, name: '프리미엄 영양제 세트', price: 80000, category: '생활/건강', image: 'https://images.unsplash.com/photo-1607619056574-7d8d3ee536b2?q=80&w=400', recommendedAges: [40, 50, 60], gender: 'all' },
        { id: 10, name: '온라인 클래스 수강권', price: 30000, category: '여가/생활편의', image: 'https://images.unsplash.com/photo-1516534775068-ba3e7458af70?q=80&w=400', recommendedAges: [20, 30, 40], gender: 'all'},
        { id: 11, name: '고급 원두커피 & 머그 세트', price: 48000, category: '식품', image: 'https://images.unsplash.com/photo-1511920183353-3c7c95a5742c?q=80&w=400', recommendedAges: [30, 40, 50], gender: 'all'},
        { id: 12, name: '인기 소설 3권 세트', price: 45000, category: '도서', image: 'https://images.unsplash.com/photo-1550399105-c4db5fb85c18?q=80&w=400', recommendedAges: [20, 30, 40, 50, 60], gender: 'all'},
        { id: 13, name: '경량 등산 스틱', price: 65000, category: '스포츠/레저', image: 'https://images.unsplash.com/photo-1592928997353-320c784a3055?q=80&w=400', recommendedAges: [50, 60], gender: 'all'},
    ];

    const filterPanel = document.getElementById('filter-panel');
    // filter-panel이 없는 페이지(faq, contact 등)에서 오류가 발생하지 않도록 null 체크
    if (filterPanel) {
        const filterPanelContent = filterPanel.querySelector('div');
        const filterTriggerBtn = document.getElementById('filter-trigger-btn');
        const productGrid = document.getElementById('product-grid');
        const resultTitle = document.getElementById('result-title');
        const loader = document.getElementById('loader');

        const filterHTML = `
            <div>
                <label class="font-semibold text-gray-700 block mb-3 text-sm">나이대는?</label>
                <div class="flex flex-wrap gap-2" data-filter-group="age">
                    <button class="filter-btn px-3 py-1.5 rounded-full" data-value="10">10대</button>
                    <button class="filter-btn px-3 py-1.5 rounded-full" data-value="20">20대</button>
                    <button class="filter-btn px-3 py-1.5 rounded-full" data-value="30">30대</button>
                    <button class="filter-btn px-3 py-1.5 rounded-full" data-value="40">40대</button>
                    <button class="filter-btn px-3 py-1.5 rounded-full" data-value="50">50대</button>
                    <button class="filter-btn px-3 py-1.5 rounded-full" data-value="60">60대+</button>
                </div>
            </div>
            <div>
                <label class="font-semibold text-gray-700 block mb-3 text-sm">성별은?</label>
                <div class="flex flex-wrap gap-2" data-filter-group="gender">
                    <button class="filter-btn px-4 py-1.5 rounded-full" data-value="female">여성</button>
                    <button class="filter-btn px-4 py-1.5 rounded-full" data-value="male">남성</button>
                </div>
            </div>
            <div>
                <label class="font-semibold text-gray-700 block mb-3 text-sm">어떤 분야에 관심있나요?</label>
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
            <button class="apply-btn w-full mt-6 text-white font-bold py-3 sm:py-4 rounded-xl text-base sm:text-lg">선물 추천받기</button>
        `;

        filterPanelContent.innerHTML = filterHTML;

        function renderProducts(productsToRender) {
            productGrid.innerHTML = '';
            if (!productsToRender || productsToRender.length === 0) {
                productGrid.innerHTML = `<div class="col-span-full text-center py-12">
                    <p class="text-xl text-gray-500">아쉽지만, 조건에 맞는 선물을 찾지 못했어요.</p>
                    <p class="text-gray-400 mt-2">조건을 변경해서 다시 찾아보세요.</p>
                </div>`;
                return;
            }
            productsToRender.forEach(product => {
                const card = document.createElement('div');
                card.className = 'product-card bg-white rounded-xl overflow-hidden group flex flex-col';
                card.innerHTML = `
                    <div class="relative"><img src="${product.image}" alt="${product.name}" onerror="this.onerror=null;this.src='https://placehold.co/400x400/f3f0e9/3A3A3A?text=Image';" class="w-full h-64 sm:h-72 object-cover"></div>
                    <div class="p-4 sm:p-5 text-center flex flex-col flex-grow">
                        <h3 class="font-semibold text-base sm:text-lg text-gray-800 truncate">${product.name}</h3>
                        <p class="font-maru text-lg sm:text-xl font-medium text-[#2F4858] mt-auto pt-2">₩${product.price.toLocaleString()}</p>
                    </div>
                `;
                productGrid.appendChild(card);
            });
        }

        function handleFilterSelection(container) {
            container.addEventListener('click', e => {
                if (e.target.tagName === 'BUTTON' && !e.target.classList.contains('apply-btn')) {
                    const group = e.target.closest('[data-filter-group]');
                    if (group) {
                        // 같은 그룹 내 다른 버튼들의 active 클래스 제거 (단일 선택)
                        group.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
                        // 현재 클릭된 버튼에 active 클래스 추가
                        e.target.classList.add('active');
                    }
                }
            });
        }

        function applyFiltersFrom(container) {
            const ageVal = container.querySelector('[data-filter-group="age"] .active')?.dataset.value;
            const genderVal = container.querySelector('[data-filter-group="gender"] .active')?.dataset.value;
            const categoryVal = container.querySelector('[data-filter-group="category"] .active')?.dataset.value;
            const budgetVal = container.querySelector('[data-filter-group="budget"] .active')?.dataset.value;
            
            const filtered = allProducts.filter(p => {
                const ageMatch = !ageVal || (parseInt(ageVal) === 60 ? p.recommendedAges.some(a => a >= 60) : p.recommendedAges.includes(parseInt(ageVal)));
                const genderMatch = !genderVal || p.gender === genderVal || p.gender === 'all';
                const categoryMatch = !categoryVal || p.category === categoryVal;
                const priceMatch = !budgetVal || p.price <= parseInt(budgetVal);
                return ageMatch && genderMatch && categoryMatch && priceMatch;
            });

            loader.style.display = 'flex';
            productGrid.innerHTML = '';
            resultTitle.innerHTML = ''; // 기존 타이틀 제거
            
            setTimeout(() => {
                loader.style.display = 'none';
                // 타이틀 컨테이너 내부의 h2 내용만 변경
                const titleElement = document.getElementById('result-title');
                if (titleElement) {
                     titleElement.innerHTML = `
                        당신을 위한 맞춤 추천
                        <span class="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/3 border-b-2 border-[#D4A373]"></span>
                    `;
                }
                renderProducts(filtered);
                document.getElementById('product-section').scrollIntoView();
            }, 800);
        }
        
        handleFilterSelection(filterPanelContent);
        filterPanelContent.querySelector('.apply-btn').addEventListener('click', () => {
            applyFiltersFrom(filterPanelContent);
            filterPanel.classList.remove('open');
            filterPanel.style.marginTop = '0';
            filterTriggerBtn.textContent = '선물 추천받기';
        });

        filterTriggerBtn.addEventListener('click', () => {
            const isOpening = !filterPanel.classList.contains('open');
            filterPanel.classList.toggle('open');
            filterPanel.style.marginTop = isOpening ? '2rem' : '0';
            filterTriggerBtn.textContent = isOpening ? '닫기' : '선물 추천받기';
        });

        // Initial Load
        renderProducts(allProducts);
    }
});