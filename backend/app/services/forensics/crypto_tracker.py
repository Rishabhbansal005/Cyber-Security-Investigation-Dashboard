import httpx
from typing import Dict, Any

class CryptoTracker:
    """
    Traces Bitcoin transactions using public Blockchain APIs (e.g., BlockCypher).
    """
    @staticmethod
    async def trace_address(address: str, coin: str = 'btc') -> Dict[str, Any]:
        """
        Fetches balance and transaction history for a given cryptocurrency address.
        Uses BlockCypher API as an example.
        """
        try:
            url = f"https://api.blockcypher.com/v1/{coin}/main/addrs/{address}/full"
            
            async with httpx.AsyncClient() as client:
                response = await client.get(url, params={'limit': 10})
                response.raise_for_status()
                data = response.json()
                
            balance_satoshi = data.get('balance', 0)
            balance = balance_satoshi / 100_000_000.0  # Convert to BTC/LTC/etc.
            
            total_received = data.get('total_received', 0) / 100_000_000.0
            total_sent = data.get('total_sent', 0) / 100_000_000.0
            
            transactions = []
            for tx in data.get('txs', []):
                tx_hash = tx.get('hash')
                confirmed = tx.get('confirmed', 'Unconfirmed')
                
                # Determine if it's incoming or outgoing relative to the address
                inputs = tx.get('inputs', [])
                outputs = tx.get('outputs', [])
                
                is_sender = any(address in inp.get('addresses', []) for inp in inputs)
                
                tx_value = tx.get('total', 0) / 100_000_000.0
                
                transactions.append({
                    "tx_hash": tx_hash,
                    "date": confirmed,
                    "type": "sent" if is_sender else "received",
                    "amount": tx_value
                })
                
            return {
                "address": address,
                "coin": coin.upper(),
                "status": "success",
                "balance": balance,
                "total_received": total_received,
                "total_sent": total_sent,
                "recent_transactions": transactions
            }

        except httpx.HTTPStatusError as e:
            return {
                "address": address,
                "status": "error",
                "error": f"API Error: {e.response.status_code} - {e.response.text}"
            }
        except Exception as e:
            return {
                "address": address,
                "status": "error",
                "error": str(e)
            }
