// js/ui.js

export function renderProducts(products, gridElement) {
    gridElement.innerHTML = '';
    if (!products || products.length === 0) {
        gridElement.innerHTML = `<div class="col-span-full text-center py-12">
            <p class="text-xl text-gray-500">아쉽지만, 조건에 맞는 선물을 찾지 못했어요.</p>
            <p class="text-gray-400 mt-2">조건을 변경해서 다시 찾아보세요.</p>
        </div>`;
        return;
    }
    products.forEach(product => {
        const card = document.createElement('a');
        card.href = product.url;
        card.target = "_blank";
        card.className = 'product-card bg-white rounded-xl overflow-hidden group flex flex-col no-underline';
        card.innerHTML = `
            <div class="relative"><img src="${product.image}" alt="${product.name}" onerror="this.onerror=null;this.src='https://placehold.co/400x400/f3f0e9/3A3A3A?text=Image';" class="w-full h-64 sm:h-72 object-cover"></div>
            <div class="p-4 sm:p-5 text-center flex flex-col flex-grow">
                <h3 class="font-semibold text-base sm:text-lg text-gray-800 truncate" style="text-decoration: none !important;">${product.name}</h3>
                <p class="font-maru text-lg sm:text-xl font-medium text-[#2F4858] mt-auto pt-2">₩${product.price.toLocaleString()}</p>
            </div>
        `;
        gridElement.appendChild(card);
    });
}

export function setupPagination(config) {
    const { container, pageCount, currentPage, onPageClick } = config;
    container.innerHTML = '';
    if (pageCount <= 1) return;

    const prevIcon = `<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>`;
    const nextIcon = `<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>`;
    
    const createPageButton = (content, pageNum) => {
        const button = document.createElement('button');
        button.innerHTML = content;
        button.className = 'pagination-btn';
        if (pageNum) {
            button.addEventListener('click', () => onPageClick(pageNum));
            if (pageNum === currentPage) {
                button.classList.add('active');
            }
        } else {
            button.disabled = true;
        }
        return button;
    };

    container.appendChild(createPageButton(prevIcon, currentPage > 1 ? currentPage - 1 : null));

    const maxPagesToShow = 5;
    const pages = [];
    if (pageCount <= maxPagesToShow + 2) {
        for (let i = 1; i <= pageCount; i++) pages.push(i);
    } else {
        pages.push(1);
        if (currentPage > 3) pages.push('...');
        let start = Math.max(2, currentPage - 1);
        let end = Math.min(pageCount - 1, currentPage + 1);
        if (currentPage <= 3) { start = 2; end = 4; }
        if (currentPage >= pageCount - 2) { start = pageCount - 3; end = pageCount - 1; }
        for (let i = start; i <= end; i++) pages.push(i);
        if (currentPage < pageCount - 2) pages.push('...');
        pages.push(pageCount);
    }

    pages.forEach(pageNum => {
        if (pageNum === '...') {
            const ellipsis = document.createElement('span');
            ellipsis.textContent = '...';
            ellipsis.className = 'pagination-ellipsis';
            container.appendChild(ellipsis);
        } else {
            container.appendChild(createPageButton(pageNum, pageNum));
        }
    });

    container.appendChild(createPageButton(nextIcon, currentPage < pageCount ? currentPage + 1 : null));
}

export function updateResultTitle(element, userProfile) {
    if (userProfile.gender || userProfile.age || userProfile.interests.length > 0) {
        element.innerHTML = `당신을 위한 맞춤 추천<span class="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/3 border-b-2 border-[#D4A373]"></span>`;
    } else {
        element.innerHTML = `지금, 가장 사랑받는 선물<span class="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/3 border-b-2 border-[#D4A373]"></span>`;
    }
}

export function toggleLoader(loaderElement, show) {
    loaderElement.style.display = show ? 'flex' : 'none';
}