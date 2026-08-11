import pandas as pd
from typing import Dict, Any

class FinancialParser:
    """
    Parses Bank Statements (CSV) to identify large transactions and frequent recipients.
    """
    @staticmethod
    def parse_statement(file_path: str, file_name: str) -> Dict[str, Any]:
        """
        Parses a bank statement CSV.
        """
        try:
            df = pd.read_csv(file_path)
            df.columns = [str(c).strip().lower().replace(" ", "_") for c in df.columns]
            
            col_map = {
                "date": "date",
                "description": "description",
                "amount": "amount",
                "debit": "debit",
                "credit": "credit",
                "balance": "balance",
                "payee": "description",
                "narrative": "description"
            }
            
            standard_df = pd.DataFrame()
            for standard_col, target in col_map.items():
                for actual_col in df.columns:
                    if standard_col in actual_col:
                        standard_df[target] = df[actual_col]
                        break
                        
            if 'description' not in standard_df.columns:
                return {
                    "file_name": file_name,
                    "status": "partial",
                    "error": "Could not map 'description' column.",
                    "total_records": len(df)
                }

            # Handle Amount (could be split into debit/credit or a signed amount)
            if 'amount' in standard_df.columns:
                # Convert to numeric, handle formatting like $1,000.00
                if standard_df['amount'].dtype == 'O':
                    standard_df['amount'] = standard_df['amount'].str.replace(',', '').str.replace('$', '').astype(float)
            elif 'debit' in standard_df.columns and 'credit' in standard_df.columns:
                standard_df['debit'] = pd.to_numeric(standard_df['debit'].astype(str).str.replace(',', '').str.replace('$', ''), errors='coerce').fillna(0)
                standard_df['credit'] = pd.to_numeric(standard_df['credit'].astype(str).str.replace(',', '').str.replace('$', ''), errors='coerce').fillna(0)
                standard_df['amount'] = standard_df['credit'] - standard_df['debit']
            else:
                return {
                    "file_name": file_name,
                    "status": "partial",
                    "error": "Could not map 'amount' or 'debit'/'credit' columns.",
                    "total_records": len(df)
                }

            # Top Payees (Debits - negative amounts)
            debits = standard_df[standard_df['amount'] < 0].copy()
            debits['amount'] = debits['amount'].abs()
            top_payees = debits.groupby('description')['amount'].sum().sort_values(ascending=False).head(10)
            payee_list = [{"name": str(k), "total_amount": float(v)} for k, v in top_payees.items()]
            
            # Largest Transactions
            largest_txs = standard_df.copy()
            largest_txs['abs_amount'] = largest_txs['amount'].abs()
            largest_txs = largest_txs.sort_values(by='abs_amount', ascending=False).head(10)
            
            largest_list = []
            for _, row in largest_txs.iterrows():
                date_val = str(row.get('date', 'Unknown Date'))
                largest_list.append({
                    "date": date_val,
                    "description": str(row['description']),
                    "amount": float(row['amount'])
                })

            return {
                "file_name": file_name,
                "status": "success",
                "total_records": len(df),
                "top_payees": payee_list,
                "largest_transactions": largest_list
            }

        except Exception as e:
            return {
                "file_name": file_name,
                "status": "error",
                "error": str(e)
            }
