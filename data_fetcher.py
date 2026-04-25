import ccxt
import pandas as pd
import pandas_ta as ta
import requests
import time

# ==========================================
# 請替換為你的 Telegram 設定
# ==========================================
TELEGRAM_BOT_TOKEN = '8708046397:AAGekn7MM8R48miUPFbouKpX0i1s0J6GNTs'
TELEGRAM_CHAT_ID = '6189992115'

def send_telegram_message(text):
    """發送訊息到 Telegram"""
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        'chat_id': TELEGRAM_CHAT_ID,
        'text': text,
        'parse_mode': 'Markdown'  # 支援粗體、斜體排版
    }
    try:
        response = requests.post(url, json=payload)
        if response.ok:
            print("✅ Telegram 訊息發送成功！")
        else:
            print(f"❌ Telegram 發送失敗: {response.text}")
    except Exception as e:
        print(f"❌ Telegram 發生錯誤: {e}")

def fetch_ohlcv_data(symbol='BTC/USDT', timeframe='15m', limit=100):
    exchange = ccxt.binance()
    try:
        ohlcv = exchange.fetch_ohlcv(symbol, timeframe, limit=limit)
        df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
        df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms') + pd.Timedelta(hours=8)
        return df
    except Exception as e:
        print(f"抓取資料發生錯誤: {e}")
        return None

def calculate_squeeze_alert(df):
    """完美對應 Pine Script 波動預警邏輯"""
    sqzLen = 20
    sqzMinBars = 5
    bbMult = 2.0
    kcMult = 1.29

    df['sma'] = df.ta.sma(length=sqzLen)
    df['stdev'] = df.ta.stdev(length=sqzLen)
    df['upperBB'] = df['sma'] + bbMult * df['stdev']
    df['lowerBB'] = df['sma'] - bbMult * df['stdev']

    df['tr'] = df.ta.true_range()
    df['sqz_rangema'] = df['tr'].rolling(window=sqzLen).mean()
    df['upperKC'] = df['sma'] + df['sqz_rangema'] * kcMult
    df['lowerKC'] = df['sma'] - df['sqz_rangema'] * kcMult

    df['baseSqzOn'] = (df['lowerBB'] > df['lowerKC']) & (df['upperBB'] < df['upperKC'])
    df['sqzCount'] = df.groupby((~df['baseSqzOn']).cumsum())['baseSqzOn'].cumsum()
    df['sqzOn'] = df['sqzCount'] >= sqzMinBars
    
    df['is_new_alert'] = (df['sqzCount'] == sqzMinBars)
    return df

# ==========================================
# 主執行邏輯 (多幣種 24小時監控迴圈)
# ==========================================
def run_monitor():
    # 🌟 1. 橫向擴充：把你想監控的幣種全部寫進這個清單裡
    symbols = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT'] 
    timeframe = '15m'
    
    # 🌟 2. 建立專屬記憶體：用字典 (Dictionary) 記錄每個幣種最後一次發送預警的時間
    last_alert_times = {symbol: None for symbol in symbols}

    symbols_str = ", ".join(symbols)
    print(f"🚀 啟動多幣種波動預警 24 小時自動監控...")
    print(f"📌 監控清單: {symbols_str}")
    
    # 啟動時發送清單到 Telegram 確認
    send_telegram_message(f"🚀 **系統啟動通知**\n已開始 24 小時自動監控波動預警！\n📌 **清單：** {symbols_str}\n⏱ **時區：** {timeframe}")

    while True:
        try:
            print(f"\n[{pd.Timestamp.now().strftime('%H:%M:%S')}] 開始執行本輪多幣種掃描...")
            
            # 依序檢查清單中的每一個幣種
            for symbol in symbols:
                # 獲取資料
                df = fetch_ohlcv_data(symbol=symbol, timeframe=timeframe, limit=100)
                
                if df is not None:
                    # 計算指標
                    df_analyzed = calculate_squeeze_alert(df)
                    
                    # 取得最新一根 K 線的狀態
                    current_candle = df_analyzed.iloc[-1]
                    current_time = current_candle['timestamp']
                    
                    print(f"  ⏳ {symbol}: 擠壓計數 = {int(current_candle['sqzCount'])}")
                    
                    # 🌟 3. 判斷邏輯：針對「當前這個幣種」是否觸發且還沒發過通知
                    if current_candle['is_new_alert'] and current_time != last_alert_times[symbol]:
                        msg = (
                            f"🚨 **波動預警觸發** 🚨\n\n"
                            f"📌 **標的：** {symbol}\n"
                            f"⏱ **時區：** {timeframe}\n"
                            f"🕒 **時間：** {current_time}\n"
                            f"💰 **當前價格：** {current_candle['close']}\n\n"
                            f"💡 _連續 {int(current_candle['sqzCount'])} 根 K 棒擠壓完成，留意突破方向！_"
                        )
                        send_telegram_message(msg)
                        
                        # 更新「該幣種」最後發送時間
                        last_alert_times[symbol] = current_time
                        print(f"  ✅ 已發送 {symbol} 預警通知！")
                
                # 保護機制：每抓完一個幣，休息 1 秒，避免被交易所 API 封鎖
                time.sleep(1)

            # 整輪掃描結束，休息 60 秒後再檢查一次
            print("本輪掃描結束，等待 60 秒後進行下一次掃描...")
            time.sleep(60)

        except Exception as e:
            print(f"❌ 監控迴圈發生錯誤: {e}")
            time.sleep(60)

if __name__ == "__main__":
    run_monitor()