"""
Wireshark / Network Analysis Adapter
Supports:
1. Direct tshark subprocess parsing (Fast, reliable, cross-platform)
2. Pure-Python binary fallback parser for .pcap and .pcapng files
"""
import os
import sys
import shutil
import struct
import logging
import subprocess
import socket
from typing import Dict, Any, List, Tuple
from collections import defaultdict

logger = logging.getLogger(__name__)


class WiresharkAdapter:
    """
    Adapter for network capture analysis (.pcap, .pcapng).
    Attempts tshark subprocess execution first; falls back to pure Python parsing if tshark is absent or fails.
    """

    def is_available(self) -> bool:
        tshark_path = self._get_tshark_path()
        return tshark_path is not None and os.path.exists(tshark_path)

    def _get_tshark_path(self) -> str | None:
        if sys.platform.startswith("win"):
            win_path = r"C:\Program Files\Wireshark\tshark.exe"
            if os.path.exists(win_path):
                return win_path
            win_path_x86 = r"C:\Program Files (x86)\Wireshark\tshark.exe"
            if os.path.exists(win_path_x86):
                return win_path_x86
        else:
            mac_path = "/Applications/Wireshark.app/Contents/MacOS/tshark"
            if os.path.exists(mac_path):
                return mac_path

        found = shutil.which("tshark")
        return found

    def get_status(self) -> Dict[str, Any]:
        available = self.is_available()
        return {
            "tool": "Wireshark / tshark",
            "available": available,
            "binary_path": self._get_tshark_path() or "Not found",
            "status": "ready" if available else "not_installed",
        }

    async def analyze_pcap(self, pcap_path: str) -> Dict[str, Any]:
        """
        Parse a PCAP or PCAPNG file and return detailed network analysis statistics.
        """
        if not os.path.exists(pcap_path):
            raise FileNotFoundError(f"PCAP file not found: {pcap_path}")

        file_size = os.path.getsize(pcap_path)
        if file_size < 24:
            raise ValueError(f"PCAP file is too small ({file_size} bytes) to contain valid capture data.")

        logger.info(f"Starting network analysis on {pcap_path} ({file_size} bytes)")

        # Try tshark first
        tshark_path = self._get_tshark_path()
        if tshark_path:
            try:
                logger.info(f"Attempting tshark analysis using: {tshark_path}")
                return self._parse_with_tshark(tshark_path, pcap_path)
            except Exception as err:
                logger.warning(f"tshark analysis failed ({err}); falling back to pure-Python parser")

        # Fallback to pure Python parser
        logger.info("Running pure-Python PCAP/PCAPNG parser fallback")
        return self._parse_with_python_fallback(pcap_path)

    def _parse_with_tshark(self, tshark_path: str, pcap_path: str) -> Dict[str, Any]:
        """
        Execute tshark binary directly and extract packet metrics via TSV output.
        """
        cmd = [
            tshark_path,
            "-r", pcap_path,
            "-T", "fields",
            "-e", "_ws.col.Protocol",
            "-e", "ip.src",
            "-e", "ip.dst",
            "-e", "ipv6.src",
            "-e", "ipv6.dst",
            "-e", "frame.len",
            "-e", "dns.qry.name",
            "-e", "dns.qry.type",
            "-E", "header=y",
            "-E", "separator=/t"
        ]

        # Use startupinfo to prevent console popup on Windows
        startupinfo = None
        if sys.platform.startswith("win"):
            startupinfo = subprocess.STARTUPINFO()
            startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW

        proc = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            errors="replace",
            startupinfo=startupinfo,
            timeout=120
        )

        if proc.returncode != 0 and not proc.stdout.strip():
            raise RuntimeError(f"tshark exit code {proc.returncode}: {proc.stderr.strip()}")

        protocol_stats = defaultdict(int)
        conversations = defaultdict(lambda: {"packets": 0, "bytes": 0})
        dns_queries = []
        dns_seen = set()
        suspicious_indicators = []
        suspicious_seen = set()

        lines = proc.stdout.splitlines()
        if len(lines) <= 1:
            # File might be empty capture or unsupported
            logger.warning("tshark output contained 0 packet lines")

        for line in lines[1:]:  # Skip header
            parts = line.split('\t')
            if len(parts) < 8:
                continue

            protocol = parts[0].strip() or "RAW"
            ip_src = parts[1].strip() or parts[3].strip()
            ip_dst = parts[2].strip() or parts[4].strip()
            frame_len_str = parts[5].strip()
            dns_name = parts[6].strip()
            dns_type = parts[7].strip()

            try:
                frame_len = int(frame_len_str) if frame_len_str else 0
            except ValueError:
                frame_len = 0

            protocol_stats[protocol] += 1

            if ip_src and ip_dst:
                conv_key = tuple(sorted([ip_src, ip_dst]))
                conversations[conv_key]["packets"] += 1
                conversations[conv_key]["bytes"] += frame_len

            if dns_name:
                for qname in dns_name.split(','):
                    qname = qname.strip().rstrip('.')
                    if qname and qname not in dns_seen:
                        dns_seen.add(qname)
                        dns_queries.append({"query": qname, "type": dns_type or "A"})

                        # Detect suspicious domains
                        is_suspicious, reason = self._check_suspicious_domain(qname)
                        if is_suspicious and qname not in suspicious_seen:
                            suspicious_seen.add(qname)
                            suspicious_indicators.append({
                                "type": "domain",
                                "value": qname,
                                "reason": reason
                            })

        # Format conversations list
        formatted_convs = [
            {"ip_a": ip1, "ip_b": ip2, "packets": stats["packets"], "bytes": stats["bytes"]}
            for (ip1, ip2), stats in conversations.items()
        ]
        formatted_convs.sort(key=lambda x: x["bytes"], reverse=True)

        return {
            "protocol_stats": dict(protocol_stats),
            "conversations": formatted_convs[:100],
            "dns_queries": dns_queries[:500],
            "suspicious_indicators": suspicious_indicators
        }

    def _parse_with_python_fallback(self, pcap_path: str) -> Dict[str, Any]:
        """
        Pure Python fallback binary parser for standard .pcap and .pcapng files.
        """
        protocol_stats = defaultdict(int)
        conversations = defaultdict(lambda: {"packets": 0, "bytes": 0})
        dns_queries = []
        dns_seen = set()
        suspicious_indicators = []
        suspicious_seen = set()

        with open(pcap_path, "rb") as f:
            magic = f.read(4)

        if len(magic) < 4:
            raise ValueError("File is too small to identify format")

        # Standard PCAP Magic numbers
        # 0xa1b2c3d4 (big endian), 0xd4c3b2a1 (little endian)
        # 0xa1b23c4d (nanosecond, big endian), 0x4d3cb2a1 (nanosecond, little endian)
        is_pcap = magic in [b'\xa1\xb2\xc3\xd4', b'\xd4\xc3\xb2\xa1', b'\xa1\xb2\x3c\x4d', b'\x4d\x3c\xb2\xa1']
        is_pcapng = magic == b'\x0a\x0d\x0d\x0a'  # PCAPNG Section Header Block

        if not is_pcap and not is_pcapng:
            raise ValueError("Unsupported capture file format (Not a standard PCAP or PCAPNG file)")

        with open(pcap_path, "rb") as f:
            if is_pcap:
                endian = ">" if magic in [b'\xa1\xb2\xc3\xd4', b'\xa1\xb2\x3c\x4d'] else "<"
                f.seek(24)  # Skip 24-byte global header

                while True:
                    pkt_hdr = f.read(16)
                    if len(pkt_hdr) < 16:
                        break
                    ts_sec, ts_usec, incl_len, orig_len = struct.unpack(f"{endian}IIII", pkt_hdr)
                    pkt_data = f.read(incl_len)
                    if len(pkt_data) < incl_len:
                        break

                    self._parse_raw_packet(pkt_data, protocol_stats, conversations, dns_queries, dns_seen, suspicious_indicators, suspicious_seen)

            elif is_pcapng:
                endian = "<"
                f.seek(0)
                while True:
                    block_hdr = f.read(8)
                    if len(block_hdr) < 8:
                        break
                    block_type, block_len = struct.unpack(f"{endian}II", block_hdr)
                    if block_len < 12:
                        break
                    block_data = f.read(block_len - 8)
                    if len(block_data) < block_len - 8:
                        break

                    # Enhanced Packet Block = 0x00000006, Simple Packet Block = 0x00000003
                    if block_type in (0x00000006, 0x00000003):
                        if block_type == 0x00000006 and len(block_data) >= 20:
                            # Interface ID (4), Timestamp High (4), Timestamp Low (4), Captured Packet Length (4)
                            captured_len = struct.unpack(f"{endian}I", block_data[12:16])[0]
                            pkt_data = block_data[20:20 + captured_len]
                            self._parse_raw_packet(pkt_data, protocol_stats, conversations, dns_queries, dns_seen, suspicious_indicators, suspicious_seen)
                        elif block_type == 0x00000003 and len(block_data) >= 8:
                            captured_len = struct.unpack(f"{endian}I", block_data[0:4])[0]
                            pkt_data = block_data[8:8 + captured_len]
                            self._parse_raw_packet(pkt_data, protocol_stats, conversations, dns_queries, dns_seen, suspicious_indicators, suspicious_seen)

        formatted_convs = [
            {"ip_a": ip1, "ip_b": ip2, "packets": stats["packets"], "bytes": stats["bytes"]}
            for (ip1, ip2), stats in conversations.items()
        ]
        formatted_convs.sort(key=lambda x: x["bytes"], reverse=True)

        if not protocol_stats:
            protocol_stats["ETH"] = 0

        return {
            "protocol_stats": dict(protocol_stats),
            "conversations": formatted_convs[:100],
            "dns_queries": dns_queries[:500],
            "suspicious_indicators": suspicious_indicators
        }

    def _parse_raw_packet(
        self,
        pkt_data: bytes,
        protocol_stats: Dict[str, int],
        conversations: Dict[Tuple[str, str], Dict[str, int]],
        dns_queries: List[Dict[str, str]],
        dns_seen: set,
        suspicious_indicators: List[Dict[str, str]],
        suspicious_seen: set
    ):
        """Parse raw Ethernet / IPv4 frame in pure Python."""
        if len(pkt_data) < 14:
            return

        # Ethernet Header (14 bytes)
        eth_type = struct.unpack("!H", pkt_data[12:14])[0]
        payload = pkt_data[14:]

        # Check for 802.1Q VLAN tag (0x8100)
        if eth_type == 0x8100 and len(payload) >= 4:
            eth_type = struct.unpack("!H", payload[2:4])[0]
            payload = payload[4:]

        if eth_type == 0x0800:  # IPv4
            if len(payload) < 20:
                return
            ihl = (payload[0] & 0x0F) * 4
            proto_id = payload[9]
            src_ip = socket.inet_ntoa(payload[12:16])
            dst_ip = socket.inet_ntoa(payload[16:20])
            total_len = len(pkt_data)

            # Protocol mapping
            proto_name = "IP"
            if proto_id == 6:
                proto_name = "TCP"
            elif proto_id == 17:
                proto_name = "UDP"
            elif proto_id == 1:
                proto_name = "ICMP"

            protocol_stats[proto_name] += 1

            conv_key = tuple(sorted([src_ip, dst_ip]))
            conversations[conv_key]["packets"] += 1
            conversations[conv_key]["bytes"] += total_len

            # Extract DNS if UDP port 53
            if proto_id == 17 and len(payload) >= ihl + 8:
                udp_hdr = payload[ihl:ihl + 8]
                src_port, dst_port = struct.unpack("!HH", udp_hdr[0:4])
                if src_port == 53 or dst_port == 53:
                    protocol_stats["DNS"] += 1
                    dns_payload = payload[ihl + 8:]
                    dns_qname = self._extract_dns_qname(dns_payload)
                    if dns_qname and dns_qname not in dns_seen:
                        dns_seen.add(dns_qname)
                        dns_queries.append({"query": dns_qname, "type": "A"})
                        is_susp, reason = self._check_suspicious_domain(dns_qname)
                        if is_susp and dns_qname not in suspicious_seen:
                            suspicious_seen.add(dns_qname)
                            suspicious_indicators.append({
                                "type": "domain",
                                "value": dns_qname,
                                "reason": reason
                            })

        elif eth_type == 0x86DD:  # IPv6
            protocol_stats["IPv6"] += 1
        elif eth_type == 0x0806:  # ARP
            protocol_stats["ARP"] += 1
        else:
            protocol_stats["OTHER"] += 1

    def _extract_dns_qname(self, dns_payload: bytes) -> str | None:
        """Helper to extract QNAME from raw DNS packet payload."""
        try:
            if len(dns_payload) < 12:
                return None
            qdcount = struct.unpack("!H", dns_payload[4:6])[0]
            if qdcount < 1:
                return None

            idx = 12
            labels = []
            while idx < len(dns_payload):
                length = dns_payload[idx]
                if length == 0:
                    break
                if length >= 192:  # Compression pointer
                    break
                idx += 1
                if idx + length > len(dns_payload):
                    break
                label = dns_payload[idx:idx + length].decode("ascii", errors="ignore")
                labels.append(label)
                idx += length

            if labels:
                return ".".join(labels)
        except Exception:
            pass
        return None

    def _check_suspicious_domain(self, domain: str) -> Tuple[bool, str]:
        """Classify suspicious domain names."""
        domain_lower = domain.lower()
        if domain_lower.endswith(".onion"):
            return True, "TOR Network DNS Request (.onion)"
        susp_tlds = (".su", ".bit", ".top", ".xyz", ".work", ".cc", ".buzz", ".fit", ".rest")
        if any(domain_lower.endswith(tld) for tld in susp_tlds):
            return True, f"Suspicious TLD Domain ({domain})"
        if len(domain_lower.split('.')[0]) > 25:
            return True, "High Entropy / Dynamic DNS Query"
        return False, ""
