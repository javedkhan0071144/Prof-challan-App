import io
import sqlite3
import pandas as pd
import streamlit as st
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

# --- DATABASE SETUP ---
def init_db():
    conn = sqlite3.connect("tax_records.db")
    c = conn.cursor()
    c.execute("""CREATE TABLE IF NOT EXISTS challans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sr_no TEXT,
        business_name TEXT, 
        address TEXT, 
        category TEXT, 
        sub_category TEXT,
        financial_from TEXT,
        financial_to TEXT,
        cr_amount REAL,
        ars_amount REAL,
        total_amount REAL, 
        last_date TEXT, 
        status TEXT)""")
    conn.commit()
    conn.close()

init_db()

# --- PDF GENERATOR ---
def generate_pdf(data):
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter
    
    # Header & Official Details
    c.setFont("Helvetica-Bold", 10)
    c.drawString(40, height - 40, "Head Of Account: 000-Tax Revenue B01601. Tax on Prof. & Calling Ordinary")
    c.setFont("Helvetica", 9)
    c.drawString(40, height - 60, "Location: Excise & Taxation Office, Near TMA Office, Kallar Syedan")
    c.drawString(40, height - 75, f"Financial Period: {data['financial_from']} to {data['financial_to']}")
    c.drawString(40, height - 90, f"Last Date: {data['last_date']}")

    # Remitter Details Box
    c.rect(35, height - 210, width - 80, 105)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(45, height - 115, f"Sr No: {data['sr_no']} | REMITTER DETAILS:")
    c.setFont("Helvetica", 9)
    c.drawString(45, height - 135, f"Business Name: {data['business_name']}")
    c.drawString(45, height - 150, f"Address: {data['address']}")
    c.drawString(45, height - 165, f"Category: {data['category']} | Sub Category: {data['sub_category']}")

    # Breakdown Amounts
    c.setFont("Helvetica", 9)
    c.drawString(45, height - 190, f"Cr. Year Amount: Rs. {data['cr_amount']:,.2f}  |  Arrears Amount: Rs. {data['ars_amount']:,.2f}")

    # Total Box
    c.setFont("Helvetica-Bold", 10)
    c.drawString(400, height - 150, f"Total Amount:")
    c.drawString(400, height - 165, f"Rs. {data['total_amount']:,.2f}")

    c.save()
    buffer.seek(0)
    return buffer

# --- STREAMLIT UI ---
st.set_page_config(page_title="Professional Tax Management", layout="wide")
st.title("🏛️ Professional Tax Management & Challan System")

menu = st.sidebar.selectbox("Navigation", ["Dashboard & Entry", "Generate Challans", "Reports"])
conn = sqlite3.connect("tax_records.db")

if menu == "Dashboard & Entry":
    st.subheader("📝 Add New Taxpayer Record")
    with st.form("entry_form"):
        col1, col2 = st.columns(2)
        with col1:
            sr_no = st.text_input("Sr No", "01")
            biz_name = st.text_input("Business Name", "Ali Refreshment & Hotel")
            address = st.text_input("Address", "Near The Light School, Rawalpindi Road, Kallar Syedan")
            category = st.text_input("Category", "EST")
            sub_category = st.text_input("Sub Category", "Hotel / Refreshment")
        with col2:
            financial_from = st.text_input("Financial From", "2026")
            financial_to = st.text_input("Financial To", "2027")
            cr_amount = st.number_input("Cr Year Amount (Rs.)", value=5000.0)
            ars_amount = st.number_input("Arrears Amount (Rs.)", value=0.0)
            last_date = st.text_input("Last Date", "30-9-2026")
            status = st.selectbox("Payment Status", ["Pending", "Paid"])

        total_amount = cr_amount + ars_amount
        st.info(f"Calculated Total Amount: Rs. {total_amount:,.2f}")

        if st.form_submit_button("Save Record"):
            c = conn.cursor()
            c.execute("""INSERT INTO challans 
                (sr_no, business_name, address, category, sub_category, financial_from, financial_to, cr_amount, ars_amount, total_amount, last_date, status) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (sr_no, biz_name, address, category, sub_category, financial_from, financial_to, cr_amount, ars_amount, total_amount, last_date, status))
            conn.commit()
            st.success("Record saved successfully!")

    st.markdown("---")
    st.subheader("📊 Existing Records Overview")
    df = pd.read_sql("SELECT * FROM challans", conn)
    st.dataframe(df, use_container_width=True)

elif menu == "Generate Challans":
    st.subheader("🖨️ Instant PDF Challan Generation")
    df = pd.read_sql("SELECT * FROM challans", conn)
    if not df.empty:
        selected = st.selectbox("Select Record", df['id'].astype(str) + " - " + df['business_name'])
        rec_id = int(selected.split(" - ")[0])
        row = df[df['id'] == rec_id].iloc[0]
        
        st.write(f"**Business:** {row['business_name']} | **Total Amount:** Rs. {row['total_amount']:,.2f}")

        if st.button("Download Official PDF Challan"):
            pdf_file = generate_pdf(row)
            st.download_button("📥 Click to Download PDF", data=pdf_file, file_name=f"Challan_{row['sr_no']}.pdf", mime="application/pdf")
    else:
        st.warning("Please add records in the Dashboard first.")

elif menu == "Reports":
    st.subheader("📈 Summary Reports")
    df = pd.read_sql("SELECT * FROM challans", conn)
    if not df.empty:
        col1, col2 = st.columns(2)
        col1.metric("Total Records", len(df))
        col2.metric("Total Tax Assessed", f"Rs. {df['total_amount'].sum():,.2f}")
        st.bar_chart(df, x="business_name", y="total_amount")
    else:
        st.info("No data yet.")
conn.close()