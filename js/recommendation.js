// js/recommendation.js

function getRecommendedKeywords(keywordData, userProfile) {
    const M = 1.5;
    const MAX_RANK = 21;
    const hasGender = !!userProfile.gender;
    const hasAge = !!userProfile.age;
    const numInterests = userProfile.interests ? userProfile.interests.length : 0;
    const hasInterests = numInterests > 0;
    const confidence = {
        gender: hasGender ? 1 : 0,
        age: hasAge ? 1 : 0,
        interests: 1 - (1 / (1 + numInterests))
    };
    const totalConfidence = confidence.gender + confidence.age + confidence.interests;
    const profileWeight = totalConfidence / (totalConfidence + M);
    const subWeights = {
        gender: totalConfidence > 0 ? confidence.gender / totalConfidence : 0,
        age: totalConfidence > 0 ? confidence.age / totalConfidence : 0,
        interests: totalConfidence > 0 ? confidence.interests / totalConfidence : 0,
    };
    const scoredKeywords = keywordData.map(item => {
        let contentScore = 0;
        let profileScore = 0;
        let reasons = [];
        let rankCount = 0;
        let rankSum = 0;
        for (const category in item.rankingsByCategory) {
            const catData = item.rankingsByCategory[category];
            if (!catData) continue;
            if (catData.overall) {
                rankSum += (MAX_RANK - catData.overall);
                rankCount++;
            }
            let tempProfileScore = 0;
            if (hasInterests && userProfile.interests.includes(category)) {
                tempProfileScore += subWeights.interests * 50;
                reasons.push(`'${category}' 관심사 일치`);
            }
            if (hasGender && catData.byGender && catData.byGender[userProfile.gender]) {
                const rank = catData.byGender[userProfile.gender];
                tempProfileScore += subWeights.gender * ((MAX_RANK - rank) * 2.5);
                reasons.push(`${userProfile.gender} 랭킹: ${rank}위`);
            }
            if (hasAge && catData.byAge && catData.byAge[userProfile.age]) {
                const rank = catData.byAge[userProfile.age];
                tempProfileScore += subWeights.age * ((MAX_RANK - rank) * 2.5);
                reasons.push(`${userProfile.age} 랭킹: ${rank}위`);
            }
            if (hasGender && hasAge && catData.byAgeGender && catData.byAgeGender[`${userProfile.gender}_${userProfile.age}`]) {
                const rank = catData.byAgeGender[`${userProfile.gender}_${userProfile.age}`];
                tempProfileScore += ((subWeights.gender + subWeights.age) / 2) * ((MAX_RANK - rank) * 3);
                reasons.push(`${userProfile.gender} ${userProfile.age} 랭킹: ${rank}위`);
            }
            profileScore = Math.max(profileScore, tempProfileScore);
        }
        contentScore = rankCount > 0 ? (rankSum / rankCount) * 2.5 : 5;
        if (profileScore === 0) {
            reasons.push('일반 인기도 기반');
        } else {
            reasons = [...new Set(reasons)];
        }
        const finalScore = (1 - profileWeight) * contentScore + profileWeight * profileScore;
        return {
            keyword: item.keyword,
            score: finalScore,
            reasons: reasons.slice(0, 2)
        };
    });
    return scoredKeywords.sort((a, b) => b.score - a.score);
}

function getSingleScoreRecommendedProducts(productData, recommendedKeywords, weights) {
    const keywordScoreMap = new Map(recommendedKeywords.map(k => [k.keyword, k.score]));
    const keywordRankMap = new Map(recommendedKeywords.map((k, index) => [k.keyword, index]));
    const totalRecommendedKeywords = recommendedKeywords.length;
    const MAX_PRODUCT_RANK = 5;
    const scoredProducts = productData.map(product => {
        let relevanceScore = 0;
        let bestKeywordRank = totalRecommendedKeywords;
        if (product.keywords) {
            for (const keyword of product.keywords) {
                if (keywordScoreMap.has(keyword)) {
                    relevanceScore += keywordScoreMap.get(keyword);
                    bestKeywordRank = Math.min(bestKeywordRank, keywordRankMap.get(keyword));
                }
            }
        }
        const qualityScore = product.rank ? MAX_PRODUCT_RANK - product.rank + 1 : 0;
        const diversityBonus = (bestKeywordRank < totalRecommendedKeywords) ? (totalRecommendedKeywords - bestKeywordRank) : 0;
        const finalScore = (weights.relevance * relevanceScore) + (weights.quality * qualityScore) + (weights.diversity * diversityBonus);
        return {
            ...product,
            finalScore,
            _details: { relevanceScore, qualityScore, diversityBonus }
        };
    });
    return scoredProducts.sort((a, b) => b.finalScore - a.finalScore);
}

export { getRecommendedKeywords, getSingleScoreRecommendedProducts };