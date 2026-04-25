<script lang="ts">
    import { onMount } from 'svelte';

    let news = $state<any[]>([]);
    let loading = $state(true);

    onMount(async () => {
        try {
            const res = await fetch('/api/news?limit=15');
            news = await res.json();
        } catch (e) {
            console.error('Failed to load news:', e);
        }
        loading = false;
    });

    function timeAgo(timestamp: number): string {
        const diff = Math.floor(Date.now() / 1000) - timestamp;
        if (diff < 3600) return `${Math.floor(diff / 60)}分鐘前`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}小時前`;
        return `${Math.floor(diff / 86400)}天前`;
    }
</script>

<div class="news-panel" id="news-panel">
    <h3 class="panel-title">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/></svg>
        最新新聞
    </h3>

    {#if loading}
        <div class="loading-state">
            {#each [1,2,3,4,5] as _}
                <div class="skeleton-card">
                    <div class="skeleton-line wide"></div>
                    <div class="skeleton-line narrow"></div>
                </div>
            {/each}
        </div>
    {:else if news.length === 0}
        <div class="empty-state">
            <p>暫無新聞資料</p>
        </div>
    {:else}
        <div class="news-list">
            {#each news as article}
                <a href={article.url} target="_blank" rel="noopener" class="news-card">
                    {#if article.imageurl}
                        <img src={article.imageurl} alt="" class="news-thumb" loading="lazy" />
                    {/if}
                    <div class="news-content">
                        <h4 class="news-title">{article.title}</h4>
                        <div class="news-meta">
                            <span class="news-source">{article.source}</span>
                            <span class="news-time">{timeAgo(article.published_on)}</span>
                        </div>
                    </div>
                </a>
            {/each}
        </div>
    {/if}
</div>

<style>
    .news-panel {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
    }
    .panel-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.95rem;
        font-weight: 600;
        color: rgba(255,255,255,0.9);
        margin: 0 0 12px 0;
        padding-bottom: 10px;
        border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .news-list {
        flex: 1;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding-right: 4px;
    }
    .news-list::-webkit-scrollbar {
        width: 4px;
    }
    .news-list::-webkit-scrollbar-track {
        background: transparent;
    }
    .news-list::-webkit-scrollbar-thumb {
        background: rgba(255,255,255,0.1);
        border-radius: 4px;
    }
    .news-card {
        display: flex;
        gap: 10px;
        padding: 10px;
        background: rgba(255,255,255,0.03);
        border-radius: 10px;
        text-decoration: none;
        color: inherit;
        transition: all 0.2s;
        border: 1px solid transparent;
    }
    .news-card:hover {
        background: rgba(255,255,255,0.06);
        border-color: rgba(255,255,255,0.08);
        transform: translateY(-1px);
    }
    .news-thumb {
        width: 56px;
        height: 56px;
        border-radius: 8px;
        object-fit: cover;
        flex-shrink: 0;
    }
    .news-content {
        flex: 1;
        min-width: 0;
    }
    .news-title {
        font-size: 0.8rem;
        font-weight: 500;
        line-height: 1.35;
        margin: 0 0 6px 0;
        color: rgba(255,255,255,0.85);
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }
    .news-meta {
        display: flex;
        gap: 8px;
        font-size: 0.7rem;
        color: rgba(255,255,255,0.35);
    }
    .news-source {
        color: #00e676;
        font-weight: 500;
    }
    .loading-state, .empty-state {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 8px;
    }
    .empty-state { justify-content: center; align-items: center; color: rgba(255,255,255,0.3); }
    .skeleton-card {
        padding: 12px;
        background: rgba(255,255,255,0.03);
        border-radius: 10px;
    }
    .skeleton-line {
        height: 10px;
        background: rgba(255,255,255,0.06);
        border-radius: 5px;
        animation: shimmer 1.5s infinite;
    }
    .skeleton-line.wide { width: 100%; margin-bottom: 8px; }
    .skeleton-line.narrow { width: 60%; }
    @keyframes shimmer {
        0%, 100% { opacity: 0.5; }
        50% { opacity: 1; }
    }
</style>
