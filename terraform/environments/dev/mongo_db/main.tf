terraform {
  backend "remote" {
    hostname = "app.terraform.io"
    organization = "rairtech"
    workspaces {
      name = "mongo-db-dev"
    }
  }
  required_providers {
    mongodbatlas = {
      source = "mongodb/mongodbatlas"
      version = "1.2.0"
    }
  }
}

module "mongo_shared" {
  source = "../../shared/mongo"
}

# common resources used in all mongo projects
module "mongo_common" {
  source = "../../../mongo"
}

resource "mongodbatlas_cluster" "primary" {
  project_id   = module.mongo_shared.mongo_project_id_map.dev.project_id
  name         = "primary"
  cluster_type = module.mongo_shared.cluster_type_map.REPLICASET

  replication_specs {
    num_shards = 1
    regions_config {
      region_name     = module.mongo_shared.gcp_region_map.us-central1
      electable_nodes = 3
      priority        = 7
      read_only_nodes = 0
    }
  }

  mongo_db_major_version       = "5.0"
  version_release_system       = module.mongo_shared.version_release_system_map.LTS
  paused                       = false
  cloud_backup                 = true
  auto_scaling_disk_gb_enabled = false
  auto_scaling_compute_enabled = false
  auto_scaling_compute_scale_down_enabled = false

  # Provider Settings "block"
  provider_name               = module.mongo_shared.gcp_provider_name
  disk_size_gb                = 10
  provider_instance_size_name = module.mongo_shared.instance_size_map.M10.name
}

resource "mongodbatlas_cloud_backup_schedule" "primary_backup" {
  project_id   = module.mongo_shared.mongo_project_id_map.dev.project_id
  cluster_name = mongodbatlas_cluster.primary.name

  reference_hour_of_day    = 3
  reference_minute_of_hour = 45
  restore_window_days      = 4
}