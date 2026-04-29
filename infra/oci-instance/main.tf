locals {
  name_prefix       = "${var.project_name}-${var.environment}"
  shape_is_flexible = endswith(var.instance_shape, ".Flex")
  service_origin    = var.assign_public_ip ? (var.service_port == 80 ? "http://${data.oci_core_vnic.web_primary.public_ip_address}" : "http://${data.oci_core_vnic.web_primary.public_ip_address}:${var.service_port}") : null
  common_tags = {
    project     = var.project_name
    environment = var.environment
    managed_by  = "terraform"
  }
}

data "oci_core_images" "instance_images" {
  count                    = var.source_image_id == "" ? 1 : 0
  compartment_id           = var.compartment_ocid
  operating_system         = var.image_operating_system
  operating_system_version = var.image_operating_system_version
  shape                    = var.instance_shape
  sort_by                  = "TIMECREATED"
  sort_order               = "DESC"
}

resource "oci_core_vcn" "main" {
  compartment_id = var.compartment_ocid
  cidr_block     = var.vcn_cidr
  display_name   = "${local.name_prefix}-vcn"
  dns_label      = "gatesvcn"
  freeform_tags  = local.common_tags
}

resource "oci_core_internet_gateway" "main" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.main.id
  display_name   = "${local.name_prefix}-igw"
  enabled        = true
  freeform_tags  = local.common_tags
}

resource "oci_core_route_table" "public" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.main.id
  display_name   = "${local.name_prefix}-public-rt"
  freeform_tags  = local.common_tags

  route_rules {
    destination       = "0.0.0.0/0"
    destination_type  = "CIDR_BLOCK"
    network_entity_id = oci_core_internet_gateway.main.id
  }
}

resource "oci_core_security_list" "public" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.main.id
  display_name   = "${local.name_prefix}-public-sl"
  freeform_tags  = local.common_tags

  ingress_security_rules {
    protocol = "6"
    source   = var.allow_ssh_cidr

    tcp_options {
      min = 22
      max = 22
    }
  }

  ingress_security_rules {
    protocol = "6"
    source   = var.allow_http_cidr

    tcp_options {
      min = var.service_port
      max = var.service_port
    }
  }

  ingress_security_rules {
    protocol = "6"
    source   = var.allow_https_cidr

    tcp_options {
      min = 443
      max = 443
    }
  }

  egress_security_rules {
    protocol    = "all"
    destination = "0.0.0.0/0"
  }
}

resource "oci_core_subnet" "public" {
  compartment_id             = var.compartment_ocid
  vcn_id                     = oci_core_vcn.main.id
  cidr_block                 = var.public_subnet_cidr
  display_name               = "${local.name_prefix}-public-subnet"
  dns_label                  = "public1"
  route_table_id             = oci_core_route_table.public.id
  security_list_ids          = [oci_core_security_list.public.id]
  prohibit_public_ip_on_vnic = false
  freeform_tags              = local.common_tags
}

resource "oci_core_instance" "web" {
  availability_domain = var.availability_domain
  compartment_id      = var.compartment_ocid
  display_name        = "${local.name_prefix}-instance"
  shape               = var.instance_shape
  freeform_tags       = local.common_tags

  dynamic "shape_config" {
    for_each = local.shape_is_flexible ? [1] : []

    content {
      ocpus         = var.instance_ocpus
      memory_in_gbs = var.instance_memory_in_gbs
    }
  }

  create_vnic_details {
    subnet_id        = oci_core_subnet.public.id
    assign_public_ip = var.assign_public_ip
    display_name     = "${local.name_prefix}-primary-vnic"
    hostname_label   = var.instance_hostname_label
  }

  source_details {
    source_type             = "image"
    source_id               = var.source_image_id != "" ? var.source_image_id : data.oci_core_images.instance_images[0].images[0].id
    boot_volume_size_in_gbs = var.boot_volume_size_in_gbs
  }

  metadata = {
    ssh_authorized_keys = trimspace(file(var.ssh_public_key_path))
    user_data = base64encode(templatefile("${path.module}/cloud-init.yaml.tftpl", {
      app_git_ref            = var.app_git_ref
      app_git_repo           = var.app_git_repo
      google_oauth_client_id = var.google_oauth_client_id
      project_name           = var.project_name
      environment            = var.environment
      service_port           = var.service_port
    }))
  }
}

data "oci_core_vnic_attachments" "web" {
  compartment_id      = var.compartment_ocid
  instance_id         = oci_core_instance.web.id
  availability_domain = var.availability_domain
}

data "oci_core_vnic" "web_primary" {
  vnic_id = data.oci_core_vnic_attachments.web.vnic_attachments[0].vnic_id
}
