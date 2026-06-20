import os
import hashlib

class TrustChain:
    def __init__(self):
        self.dev_mode = os.environ.get("LUCY_DEV_MODE", "false").lower() == "true"
        self.attestation_passed = False

    def check_boot_rom(self):
        """Simulate BootROM integrity check."""
        return True

    def check_signatures(self):
        """Simulate signature verification of the OS image."""
        return True

    def check_hash_verification(self):
        """Simulate hashing of core binaries."""
        return True

    def unlock_hsm(self):
        """Simulate unlocking the Hardware Security Module."""
        return True

    def run_attestation(self):
        print("[BOOT] Running Chain of Trust Attestation...")
        
        checks = [
            ("BootROM", self.check_boot_rom()),
            ("Signature Check", self.check_signatures()),
            ("Hash Verification", self.check_hash_verification()),
            ("HSM Unlock", self.unlock_hsm())
        ]
        
        for name, passed in checks:
            if not passed:
                error_msg = f"{name} validation failed."
                if not self.dev_mode:
                    print(f"[BOOT ERROR] {error_msg}")
                    return False
                else:
                    print(f"[BOOT WARN] {error_msg} (Ignored due to dev mode)")

        self.attestation_passed = True
        print("[BOOT] Chain of Trust OK")
        return True
