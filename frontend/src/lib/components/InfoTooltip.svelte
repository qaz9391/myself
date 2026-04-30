<script lang="ts">
    let { text } = $props();
    let show = $state(false);
</script>

<div class="tooltip-container" 
     onmouseenter={() => show = true} 
     onmouseleave={() => show = false}
     onclick={() => show = !show}
     onkeydown={(e) => e.key === 'Enter' && (show = !show)}
     role="button"
     tabindex="0">
    <span class="icon">ℹ️</span>
    {#if show}
        <div class="tooltip-content">
            {text}
        </div>
    {/if}
</div>

<style>
    .tooltip-container {
        position: relative;
        display: inline-flex;
        align-items: center;
        margin-left: 6px;
        cursor: pointer;
    }
    .icon {
        font-size: 0.9em;
        opacity: 0.7;
        transition: opacity 0.2s;
    }
    .tooltip-container:hover .icon {
        opacity: 1;
    }
    .tooltip-content {
        position: absolute;
        bottom: 130%;
        left: 50%;
        transform: translateX(-50%);
        width: max-content;
        max-width: 280px;
        background: #1e293b;
        color: #f8fafc;
        padding: 10px 14px;
        border-radius: 8px;
        font-size: 0.8rem;
        font-weight: 500;
        line-height: 1.5;
        box-shadow: 0 10px 25px rgba(0,0,0,0.8);
        border: 1px solid rgba(255,255,255,0.15);
        z-index: 9999;
        text-align: left;
        pointer-events: none;
        white-space: pre-wrap;
    }
    .tooltip-content::after {
        content: '';
        position: absolute;
        top: 100%;
        left: 50%;
        margin-left: -6px;
        border-width: 6px;
        border-style: solid;
        border-color: #1e293b transparent transparent transparent;
    }
</style>
