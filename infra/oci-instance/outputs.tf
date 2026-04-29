output "instance_id" {
  description = "OCID of the created compute instance"
  value       = oci_core_instance.web.id
}

output "instance_public_ip" {
  description = "Public IP address of the instance primary VNIC"
  value       = data.oci_core_vnic.web_primary.public_ip_address
}

output "instance_private_ip" {
  description = "Private IP address of the instance primary VNIC"
  value       = data.oci_core_vnic.web_primary.private_ip_address
}

output "service_origin" {
  description = "Origin of the gates app when a public IP is assigned"
  value       = local.service_origin
}

output "healthcheck_url" {
  description = "Convenience URL for the gates health endpoint when a public IP is assigned"
  value       = local.service_origin != null ? "${local.service_origin}${var.app_healthcheck_path}" : null
}

output "oauth_origin_hint" {
  description = "Origin to add to Google OAuth authorized JavaScript origins"
  value       = local.service_origin
}

output "ssh_command" {
  description = "Convenience SSH command using the default Oracle Linux opc user"
  value       = var.assign_public_ip ? "ssh -i <private-key-path> opc@${data.oci_core_vnic.web_primary.public_ip_address}" : "No public IP assigned; use a bastion or private network path."
}

output "deploy_command_hint" {
  description = "Command to rerun the in-instance app deployment bootstrap after SSH login"
  value       = "sudo /usr/local/bin/deploy-gates.sh"
}
