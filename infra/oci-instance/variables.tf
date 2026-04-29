variable "tenancy_ocid" {
  description = "OCI tenancy OCID"
  type        = string
}

variable "user_ocid" {
  description = "OCI user OCID"
  type        = string
}

variable "fingerprint" {
  description = "Fingerprint for the uploaded OCI API key"
  type        = string
}

variable "private_key_path" {
  description = "Path to the OCI API private key PEM file"
  type        = string
}

variable "region" {
  description = "OCI region, preferably the tenancy home region for Always Free use"
  type        = string
}

variable "compartment_ocid" {
  description = "Compartment OCID where the network and instance will be created"
  type        = string
}

variable "availability_domain" {
  description = "Availability domain name such as Uocm:PHX-AD-1"
  type        = string
}

variable "ssh_public_key_path" {
  description = "Path to the SSH public key to inject into the instance"
  type        = string
}

variable "google_oauth_client_id" {
  description = "Google OAuth Client ID injected into the gates app container"
  type        = string
}

variable "project_name" {
  description = "Name prefix used in OCI display names and freeform tags"
  type        = string
  default     = "gates"
}

variable "environment" {
  description = "Environment label used in names and tags"
  type        = string
  default     = "dev"
}

variable "vcn_cidr" {
  description = "VCN CIDR block"
  type        = string
  default     = "10.52.0.0/16"
}

variable "public_subnet_cidr" {
  description = "Public subnet CIDR block"
  type        = string
  default     = "10.52.1.0/24"
}

variable "instance_shape" {
  description = "Compute shape for the instance"
  type        = string
  default     = "VM.Standard.A1.Flex"
}

variable "instance_ocpus" {
  description = "Number of OCPUs for the instance"
  type        = number
  default     = 1
}

variable "instance_memory_in_gbs" {
  description = "Memory in GB for the instance"
  type        = number
  default     = 6
}

variable "boot_volume_size_in_gbs" {
  description = "Boot volume size in GB. Keep >= 50 for a comfortable Always Free-compatible default"
  type        = number
  default     = 50
}

variable "instance_hostname_label" {
  description = "DNS hostname label for the instance primary VNIC"
  type        = string
  default     = "gatesvm"
}

variable "assign_public_ip" {
  description = "Whether to assign a public IP to the primary VNIC"
  type        = bool
  default     = true
}

variable "image_operating_system" {
  description = "Operating system name used for image lookup when source_image_id is not provided"
  type        = string
  default     = "Oracle Linux"
}

variable "image_operating_system_version" {
  description = "Operating system version used for image lookup when source_image_id is not provided"
  type        = string
  default     = "9"
}

variable "source_image_id" {
  description = "Optional explicit image OCID. When set, image lookup is skipped"
  type        = string
  default     = ""
}

variable "allow_ssh_cidr" {
  description = "CIDR allowed to access SSH"
  type        = string
  default     = "0.0.0.0/0"
}

variable "allow_http_cidr" {
  description = "CIDR allowed to access HTTP"
  type        = string
  default     = "0.0.0.0/0"
}

variable "allow_https_cidr" {
  description = "CIDR allowed to access HTTPS"
  type        = string
  default     = "0.0.0.0/0"
}

variable "service_port" {
  description = "Host port exposed by the instance for the gates web app"
  type        = number
  default     = 80
}

variable "app_git_repo" {
  description = "Git repository URL cloned on the OCI instance during bootstrap"
  type        = string
  default     = "https://github.com/passionconti/gates.git"
}

variable "app_git_ref" {
  description = "Git branch, tag, or commit checked out on the OCI instance during bootstrap"
  type        = string
  default     = "main"
}

variable "app_healthcheck_path" {
  description = "Health check path exposed by the gates app"
  type        = string
  default     = "/healthz"
}
